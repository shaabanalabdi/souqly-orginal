// FILE: backend/src/shared/utils/jwt.ts

import jwt from 'jsonwebtoken';
import { TrustTier, type AccountType, type Role, type StaffRole } from '@prisma/client';
import type { SignOptions } from 'jsonwebtoken';
import { normalizeAccessClaims } from '../auth/authorization.js';

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required.`);
    }
    return value;
}

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '15m') as SignOptions['expiresIn'];
const REFRESH_EXPIRES_IN = (process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'];

function getJwtSecret(): string {
    return requiredEnv('JWT_SECRET');
}

function getRefreshSecret(): string {
    return requiredEnv('REFRESH_TOKEN_SECRET');
}

export interface AccessTokenPayload {
    userId: number;
    role: Role;
    staffRole: StaffRole;
    accountType: AccountType;
    trustTier: TrustTier;
}

export interface AccessTokenPayloadInput {
    userId: number;
    role?: Role;
    staffRole?: StaffRole;
    accountType?: AccountType;
    trustTier?: TrustTier;
}

export interface RefreshTokenPayload {
    userId: number;
    version: number; // for rotation
}

function normalizeTrustTier(trustTier: TrustTier | undefined): TrustTier {
    return trustTier ?? TrustTier.NEW;
}

function normalizeAccessTokenPayload(payload: AccessTokenPayloadInput): AccessTokenPayload {
    const normalizedClaims = normalizeAccessClaims(payload);
    return {
        userId: payload.userId,
        role: normalizedClaims.role,
        staffRole: normalizedClaims.staffRole,
        accountType: normalizedClaims.accountType,
        trustTier: normalizeTrustTier(payload.trustTier),
    };
}

export function signAccessToken(payload: AccessTokenPayloadInput): string {
    return jwt.sign(normalizeAccessTokenPayload(payload), getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, getJwtSecret()) as Partial<AccessTokenPayload>;

    if (!Number.isInteger(decoded.userId) || Number(decoded.userId) <= 0) {
        throw new Error('Invalid access token payload.');
    }

    return normalizeAccessTokenPayload({
        userId: Number(decoded.userId),
        role: decoded.role,
        staffRole: decoded.staffRole,
        accountType: decoded.accountType,
        trustTier: decoded.trustTier,
    });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
    return jwt.sign(payload, getRefreshSecret(), { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
    return jwt.verify(token, getRefreshSecret()) as RefreshTokenPayload;
}
