import nodemailer, { Transporter } from 'nodemailer';
import { Booking } from '../types';
import { query } from '../config/db';

/**
 * Email service. Uses real SMTP if SMTP_* env vars are set (e.g. you wire
 * up a free Mailtrap/Gmail-app-password account), otherwise falls back to
 * just logging the email to the console — so the project runs end-to-end
 * with ZERO paid services, but the integration point is real and swappable.
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

export async function sendBookingConfirmationEmail(
  userId: string,
  booking: Booking
): Promise<void> {
  const { rows } = await query<{ email: string; name: string }>(
    `SELECT email, name FROM users WHERE id = $1`,
    [userId]
  );
  const user = rows[0];
  if (!user) return;

  const subject = `Booking Confirmed — ${booking.booking_ref}`;
  const html = `
    <h2>Your booking is confirmed!</h2>
    <p>Hi ${user.name},</p>
    <p>Your booking <strong>${booking.booking_ref}</strong> for $${booking.total_amount} has been confirmed.</p>
    <p>Thanks for using SeatLock 🎟️</p>
  `;

  const t = getTransporter();
  if (!t) {
    // eslint-disable-next-line no-console
    console.log(`📧 [MOCK EMAIL] To: ${user.email} | Subject: ${subject}`);
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@seatlock.app',
    to: user.email,
    subject,
    html,
  });
}
