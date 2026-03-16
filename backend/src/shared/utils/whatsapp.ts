import { logger } from './logger.js';

export interface SendWhatsAppOtpInput {
    phone: string;
    code: string;
}

/**
 * Provider-agnostic WhatsApp OTP sender.
 * Current implementation is mock-friendly and logs delivery attempts.
 */
export async function sendWhatsAppOTP(input: SendWhatsAppOtpInput): Promise<boolean> {
    const provider = (process.env.WHATSAPP_PROVIDER ?? 'mock').toLowerCase();

    if (provider === 'mock') {
        logger.info(`WhatsApp OTP (mock) queued for ${input.phone}`);
        if (process.env.WHATSAPP_DEBUG_LOG_CODE === 'true') {
            logger.info(`WhatsApp OTP code for ${input.phone}: ${input.code}`);
        }
        return true;
    }

    logger.warn(`WhatsApp provider "${provider}" is not configured. Falling back to failed delivery.`);
    return false;
}
