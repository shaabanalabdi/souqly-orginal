import type { NextFunction, Request, Response } from 'express';
import type { AnyZodObject, ZodTypeAny } from 'zod';
import { ZodError } from 'zod';

type SchemaGroup = {
    body?: AnyZodObject | ZodTypeAny;
    params?: AnyZodObject | ZodTypeAny;
    query?: AnyZodObject | ZodTypeAny;
};

export function validate(schema: SchemaGroup) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            if (schema.body) {
                req.body = schema.body.parse(req.body);
            }

            if (schema.params) {
                req.params = schema.params.parse(req.params);
            }

            if (schema.query) {
                req.query = schema.query.parse(req.query);
            }

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Validation failed.',
                        details: error.issues,
                    },
                });
                return;
            }

            next(error);
        }
    };
}
