// FILE: backend/src/shared/utils/otp.ts

import { redis } from './redis.js';
import crypto from 'crypto';

const OTP_TTL_SECONDS = 600; // 10 minutes
const OTP_MAX_ATTEMPTS = 3;
const OTP_LENGTH = 6;

function otpKey(phone: string): string {
    return `otp:${phone}`;
}

function otpAttemptsKey(phone: string): string {
    return `otp:attempts:${phone}`;
}

/** Generate and store a 6-digit OTP for a phone number */
export async function generateOTP(phone: string): Promise<string> {
    const code = crypto.randomInt(100000, 999999).toString().padStart(OTP_LENGTH, '0');
    await redis.setex(otpKey(phone), OTP_TTL_SECONDS, code);
    await redis.del(otpAttemptsKey(phone));
    return code;
}

/** Verify an OTP — returns true if valid, false if not */
export async function verifyOTP(phone: string, code: string): Promise<boolean> {
    // Check attempts
    const attempts = parseInt(await redis.get(otpAttemptsKey(phone)) || '0', 10);
    if (attempts >= OTP_MAX_ATTEMPTS) {
        await redis.del(otpKey(phone));
        return false;
    }

    const stored = await redis.get(otpKey(phone));
    if (!stored) return false;

    if (stored !== code) {
        await redis.incr(otpAttemptsKey(phone));
        await redis.expire(otpAttemptsKey(phone), OTP_TTL_SECONDS);
        return false;
    }

    // Valid — clean up
    await redis.del(otpKey(phone));
    await redis.del(otpAttemptsKey(phone));
    return true;
}
