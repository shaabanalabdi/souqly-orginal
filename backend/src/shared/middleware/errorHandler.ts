import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger.js';

export class ApiError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details?: unknown;

    public constructor(statusCode: number, code: string, message: string, details?: unknown) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    void _next;

    const isInvalidJsonBody =
        err instanceof SyntaxError &&
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        (err as { status?: number }).status === 400 &&
        'body' in err;

    if (isInvalidJsonBody) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_JSON_BODY',
                message: 'Request body must be valid JSON.',
            },
        });
        return;
    }

    if (err instanceof ApiError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
        });
        return;
    }

    logger.error('Unhandled error', err);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
        },
    });
};
