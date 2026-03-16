import multer from 'multer';
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { uploadImagesController } from './media.controller.js';

const mediaRoutes = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 10,
        fileSize: 8 * 1024 * 1024,
    },
});

mediaRoutes.post('/media/upload', authenticate, upload.array('images', 10), uploadImagesController);

export default mediaRoutes;
