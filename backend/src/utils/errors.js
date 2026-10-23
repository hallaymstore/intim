import { z } from 'zod';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Noto\'g\'ri ID');

export function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new HttpError(400, 'Ma\'lumotlar noto\'g\'ri', r.error.flatten().fieldErrors);
  }
  return r.data;
}
