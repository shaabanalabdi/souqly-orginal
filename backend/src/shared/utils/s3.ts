// FILE: backend/src/shared/utils/s3.ts

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
    forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || 'souqly-media';
const CDN_URL = process.env.S3_CDN_URL || '';

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

function buildOriginBaseUrls(): string[] {
    const values = new Set<string>();

    if (CDN_URL) {
        values.add(trimTrailingSlash(CDN_URL));
    }

    if (process.env.S3_ENDPOINT) {
        values.add(`${trimTrailingSlash(process.env.S3_ENDPOINT)}/${BUCKET}`);
    }

    return Array.from(values);
}

export interface UploadResult {
    key: string;
    url: string;
}

/** Upload a buffer to S3. Returns the key and public URL. */
export async function uploadToS3(
    buffer: Buffer,
    originalName: string,
    contentType: string,
    folder: string = 'uploads',
): Promise<UploadResult> {
    const ext = path.extname(originalName);
    const key = `${folder}/${uuidv4()}${ext}`;

    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
    }));

    const url = CDN_URL ? `${CDN_URL}/${key}` : `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;

    return { key, url };
}

export function getManagedMediaBaseUrls(): string[] {
    return buildOriginBaseUrls();
}

export function isManagedMediaUrl(url: string, folderPrefix?: string): boolean {
    const normalizedUrl = trimTrailingSlash(url);
    const baseUrls = buildOriginBaseUrls();

    return baseUrls.some((baseUrl) => {
        const normalizedBase = trimTrailingSlash(baseUrl);
        const prefix = folderPrefix ? `${normalizedBase}/${folderPrefix}/` : `${normalizedBase}/`;
        return normalizedUrl.startsWith(prefix);
    });
}

/** Delete an object from S3 by key */
export async function deleteFromS3(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
    }));
}
