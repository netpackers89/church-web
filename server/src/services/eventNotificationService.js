import { pool } from '../config/db.js';
import { sendEmailNotification } from '../email/index.js';

function eventMessage(event) {
	const when = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa' }).format(new Date(event.startAt));
	return `${event.title} is happening ${when}${event.location ? ` at ${event.location}` : ''}. View details: /events/${event.id}`;
}

// A caller must opt into recipients explicitly. Department events go only to
// department members; all-member delivery requires notifyAllMembers=true.
export async function queueEventNotifications(event) {
	if (!event.notifyMembers || (!event.audienceDepartmentId && !event.notifyAllMembers)) return 0;
	const recipients = await pool.query(`SELECT DISTINCT u.id,u.email,u.notify_email AS "notifyEmail" FROM users u
		LEFT JOIN department_members dm ON dm.user_id=u.id
		WHERE u.account_status='ACTIVE' AND ($1::bigint IS NULL OR dm.department_id=$1)`, [event.audienceDepartmentId ?? null]);
	const body = eventMessage(event);
	const inserted = [];
	for (const recipient of recipients.rows) {
		const result = await pool.query(`INSERT INTO user_notifications(user_id,event_id,type,title,body,link_url,email_status)
			VALUES($1,$2,'EVENT_PUBLISHED',$3,$4,$5,CASE WHEN $6 THEN 'PENDING' ELSE 'SKIPPED' END)
			ON CONFLICT (user_id,event_id,type) WHERE event_id IS NOT NULL DO NOTHING RETURNING id,user_id`, [recipient.id,event.id,event.title,body,`/events/${event.id}`,Boolean(recipient.notifyEmail)]);
		if (result.rowCount) inserted.push({ notificationId: result.rows[0].id, ...recipient });
	}
	// Delivery is intentionally outside the event transaction: a mail outage
	// cannot undo a saved published event or its in-app notices.
	for (const delivery of inserted.filter((item) => item.notifyEmail && item.email)) {
		try {
			await sendEmailNotification({ to: delivery.email, subject: `Church event: ${event.title}`, text: body });
			await pool.query(`UPDATE user_notifications SET email_status='SENT' WHERE id=$1`, [delivery.notificationId]);
		} catch (error) {
			console.error('[events] notification email failed:', error.message);
			await pool.query(`UPDATE user_notifications SET email_status='FAILED' WHERE id=$1`, [delivery.notificationId]);
		}
	}
	return inserted.length;
}
