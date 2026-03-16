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

/** Delete an object from S3 by key */
export async function deleteFromS3(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
    }));
}
