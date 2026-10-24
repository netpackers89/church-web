import PDFDocument from 'pdfkit';
import { config } from '../config/env.js';

function pdfText(value) {
	return String(value ?? '').replace(/[^\x20-\xFF]/g, '?').trim() || 'Not provided';
}

function receiptDate(value) {
	if (!value) return 'Not provided';
	const date = new Date(value);
	if (Number.isNaN(date.valueOf())) return 'Not provided';
	return new Intl.DateTimeFormat('en', {
		dateStyle: 'long',
		timeZone: config.churchTimezone,
	}).format(date);
}

export function createContributionReceiptPdf(receipt) {
	return new Promise((resolve, reject) => {
		const document = new PDFDocument({ size: 'A4', margin: 56, info: { Title: `Contribution receipt ${receipt.receiptNumber}` } });
		const chunks = [];
		document.on('data', (chunk) => chunks.push(chunk));
		document.on('error', reject);
		document.on('end', () => resolve(Buffer.concat(chunks)));

		const churchName = pdfText(receipt.churchName || config.branding.churchName);
		document.fillColor('#143b5d').font('Helvetica-Bold').fontSize(21).text(churchName, { align: 'center' });
		document.moveDown(0.4).fillColor('#506273').font('Helvetica').fontSize(10)
			.text(pdfText(receipt.churchAddress || config.branding.email || ''), { align: 'center' });
		document.moveDown(1.5).fillColor('#143b5d').font('Helvetica-Bold').fontSize(17)
			.text('OFFICIAL CONTRIBUTION RECEIPT', { align: 'center' });
		document.moveDown(0.4).fontSize(12).text(`Receipt number: ${pdfText(receipt.receiptNumber)}`, { align: 'center' });
		document.moveDown(1.5);

		const rows = [
			['Contributor', receipt.contributorName],
			['Recipient', receipt.payerMode === 'OTHER' ? receipt.recipientName : 'Self'],
			['Purpose', receipt.otherPurpose || receipt.campaignTitle || receipt.categoryName || 'General contribution'],
			['Amount', `${pdfText(receipt.currency || 'ETB')} ${pdfText(receipt.amount)}`],
			['Payment date', receiptDate(receipt.receivedAt)],
			['Approval date', receiptDate(receipt.verifiedAt || new Date())],
			['Transaction reference', receipt.paymentReference],
		];
		for (const [label, value] of rows) {
			const y = document.y;
			document.fillColor('#506273').font('Helvetica-Bold').fontSize(10).text(label, 56, y, { width: 150 });
			document.fillColor('#1f2937').font('Helvetica').fontSize(10).text(pdfText(value), 206, y, { width: 330 });
			document.moveDown(1.1);
			document.moveTo(56, document.y).lineTo(539, document.y).strokeColor('#d8e0e7').stroke();
			document.moveDown(0.65);
		}

		document.moveDown(1).fillColor('#506273').font('Helvetica').fontSize(10)
			.text('This receipt confirms that the contribution above has been reviewed and approved by the church finance team.', { align: 'center', lineGap: 4 });
		document.moveDown(2).fillColor('#143b5d').font('Helvetica-Bold').fontSize(11)
			.text(`Thank you for supporting ${churchName}.`, { align: 'center' });
		document.end();
	});
}
