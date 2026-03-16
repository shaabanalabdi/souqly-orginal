import { Resend } from 'resend';
import { logger } from './logger.js';

const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@souqly.com';

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return null;
    }

    if (!resendClient) {
        resendClient = new Resend(apiKey);
    }

    return resendClient;
}

interface EmailParams {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
    try {
        const resend = getResendClient();

        if (!resend) {
            logger.warn(`[DEV] Email to ${params.to}: ${params.subject}`);
            logger.warn(`[DEV] Body preview: ${params.html.substring(0, 200)}...`);
            return true;
        }

        await resend.emails.send({
            from: EMAIL_FROM,
            to: params.to,
            subject: params.subject,
            html: params.html,
        });

        logger.info(`Email sent to ${params.to}: ${params.subject}`);
        return true;
    } catch (error) {
        logger.error('Email send failed:', error);
        return false;
    }
}

export function verificationEmailHtml(name: string, token: string): string {
    const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${name}!</h2>
      <p>Thanks for registering on Souqly. Please verify your email address:</p>
      <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #1E3A5F; color: #fff; border-radius: 8px; text-decoration: none;">Verify Email</a>
      <p style="margin-top: 20px; color: #7F8C8D; font-size: 14px;">This link is valid for 1 hour.</p>
    </div>
  `;
}

export function resetPasswordEmailHtml(name: string, token: string): string {
    const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${name}!</h2>
      <p>We received a request to reset your password.</p>
      <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #1E3A5F; color: #fff; border-radius: 8px; text-decoration: none;">Reset Password</a>
      <p style="margin-top: 20px; color: #7F8C8D; font-size: 14px;">This link is valid for 1 hour.</p>
    </div>
  `;
}
