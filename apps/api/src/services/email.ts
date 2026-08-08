import nodemailer from 'nodemailer';
import { getEnv } from '@private-md-bot/config';

export async function sendPaymentNotificationEmail(data: {
  userEmail: string;
  utrNumber: string;
  amount: number;
  paymentId: string;
}) {
  const env = getEnv();
  const adminEmails = ['contact.subhroy@gmail.com', 'aarxslan@gmail.com'];

  console.log(`\n========================================`);
  console.log(` 📩 NEW PAYMENT NOTIFICATION RECEIVED!`);
  console.log(` User: ${data.userEmail}`);
  console.log(` UTR Ref: ${data.utrNumber}`);
  console.log(` Amount: ₹${data.amount}`);
  console.log(` Payment ID: ${data.paymentId}`);
  console.log(` Admins Notified: ${adminEmails.join(', ')}`);
  console.log(`========================================\n`);

  // Send real email if SMTP credentials are provided in env
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"Caldera Bot Monetization" <${smtpUser}>`,
        to: adminEmails,
        subject: `💳 New Bot Activation Payment (₹${data.amount}) from ${data.userEmail}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f5; color: #18181b;">
            <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e4e4e7;">
              <h2 style="color: #fc5000; margin-top: 0;">New Payment Submitted</h2>
              <p>A user has paid <strong>₹${data.amount}</strong> for bot activation and submitted their UTR number for verification.</p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px 0; color: #71717a;">User Email:</td><td><strong>${data.userEmail}</strong></td></tr>
                <tr><td style="padding: 8px 0; color: #71717a;">UTR / Transaction Ref:</td><td><strong style="color: #2563eb;">${data.utrNumber}</strong></td></tr>
                <tr><td style="padding: 8px 0; color: #71717a;">Amount Paid:</td><td><strong>₹${data.amount}</strong></td></tr>
                <tr><td style="padding: 8px 0; color: #71717a;">Payment ID:</td><td><code>${data.paymentId}</code></td></tr>
              </table>

              <p style="margin-top: 20px;">Please open your <a href="${env.WEB_URL}/dashboard/security" style="color: #fc5000; font-weight: bold;">Dashboard Admin Panel</a> to verify and approve this account.</p>
            </div>
          </div>
        `,
      });
      console.log('✅ Email notification sent via SMTP successfully to admins');
    } catch (err) {
      console.error('Failed to send SMTP email:', err);
    }
  }
}
