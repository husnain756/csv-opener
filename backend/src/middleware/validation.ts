import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validateStartProcessing = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const schema = Joi.object({
    jobId: Joi.string().uuid().required(),
    urlColumn: Joi.string().min(1).required(),
    contentType: Joi.string().valid('company', 'person', 'news').required(),
    fileName: Joi.string().optional(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400).json({
      error: 'Validation error',
      details: error.details.map(detail => detail.message),
    });
    return;
  }

  next();
};

export const validateJobId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const schema = Joi.object({
    jobId: Joi.string().uuid().required(),
  });

  const { error } = schema.validate(req.params);
  if (error) {
    res.status(400).json({
      error: 'Invalid job ID',
      details: error.details.map(detail => detail.message),
    });
    return;
  }

  next();
};

