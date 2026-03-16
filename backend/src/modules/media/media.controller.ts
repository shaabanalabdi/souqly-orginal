import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../shared/middleware/errorHandler.js';
import { uploadListingImages } from './media.service.js';

export async function uploadImagesController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        const items = await uploadListingImages(files);

        res.status(201).json({
            success: true,
            data: {
                items,
            },
        });
    } catch (error) {
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                next(new ApiError(400, 'IMAGE_TOO_LARGE', 'Each image must be <= 8MB.'));
                return;
            }
            if (error.code === 'LIMIT_FILE_COUNT') {
                next(new ApiError(400, 'TOO_MANY_IMAGES', 'Maximum 10 images are allowed.'));
                return;
            }
        }

        next(error);
    }
}
