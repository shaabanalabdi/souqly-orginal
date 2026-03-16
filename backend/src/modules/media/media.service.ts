import sharp from 'sharp';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { uploadToS3 } from '../../shared/utils/s3.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILES_PER_REQUEST = 10;

export interface UploadedMediaItem {
    key: string;
    url: string;
    contentType: string;
    size: number;
}

function ensureValidImages(files: Express.Multer.File[]): void {
    if (!files.length) {
        throw new ApiError(400, 'IMAGES_REQUIRED', 'At least one image is required.');
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
        throw new ApiError(400, 'TOO_MANY_IMAGES', `Maximum ${MAX_FILES_PER_REQUEST} images are allowed per request.`);
    }

    for (const file of files) {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            throw new ApiError(400, 'INVALID_IMAGE_TYPE', `Unsupported image type: ${file.mimetype}`);
        }
    }
}

async function optimizeImage(file: Express.Multer.File): Promise<Buffer> {
    return sharp(file.buffer)
        .rotate()
        .resize({
            width: 1920,
            height: 1920,
            fit: 'inside',
            withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
}

export async function uploadListingImages(files: Express.Multer.File[]): Promise<UploadedMediaItem[]> {
    ensureValidImages(files);

    const uploaded = await Promise.all(
        files.map(async (file) => {
            const optimizedBuffer = await optimizeImage(file);
            const originalName = file.originalname.replace(/\.[^/.]+$/, '');
            const safeName = `${originalName || 'image'}.webp`;
            const result = await uploadToS3(optimizedBuffer, safeName, 'image/webp', 'listings');

            return {
                key: result.key,
                url: result.url,
                contentType: 'image/webp',
                size: optimizedBuffer.byteLength,
            } satisfies UploadedMediaItem;
        }),
    );

    return uploaded;
}
