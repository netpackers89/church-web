WITH seed_batch AS (
  SELECT created_at
  FROM departments
  WHERE name IN ('Worship', 'Children', 'Youth', 'Outreach', 'Media', 'Prayer')
  GROUP BY created_at
  HAVING COUNT(*) = 6
),
unused_seed_departments AS (
  SELECT d.id
  FROM departments d
  JOIN seed_batch b ON b.created_at = d.created_at
  WHERE d.name IN ('Worship', 'Children', 'Youth', 'Outreach', 'Media', 'Prayer')
    AND d.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM department_members m WHERE m.department_id = d.id)
    AND NOT EXISTS (SELECT 1 FROM member_join_requests r WHERE r.department_id = d.id)
    AND NOT EXISTS (SELECT 1 FROM announcements a WHERE a.department_id = d.id)
    AND NOT EXISTS (SELECT 1 FROM programs p WHERE p.department_id = d.id)
    AND NOT EXISTS (SELECT 1 FROM events e WHERE e.audience_department_id = d.id)
    AND NOT EXISTS (
      SELECT 1 FROM events e
      WHERE e.audience_group_id = d.id AND e.audience_group_type = 'department'
    )
    AND NOT EXISTS (
      SELECT 1 FROM group_follows f
      WHERE f.group_id = d.id AND f.group_type = 'department'
    )
    AND NOT EXISTS (
      SELECT 1 FROM group_posts p
      WHERE p.group_id = d.id AND p.group_type = 'department'
    )
    AND NOT EXISTS (
      SELECT 1 FROM group_notification_preferences p
      WHERE p.group_id = d.id AND p.group_type = 'department'
    )
    AND NOT EXISTS (
      SELECT 1 FROM group_notification_deliveries dly
      WHERE dly.group_id = d.id AND dly.group_type = 'department'
    )
)
UPDATE departments d
SET deleted_at = NOW(), is_active = FALSE
FROM unused_seed_departments unused
WHERE d.id = unused.id;
