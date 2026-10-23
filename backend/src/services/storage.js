import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env.js';

const { accountId, accessKeyId, secretAccessKey, bucket, publicUrl } = config.r2;

export const r2Enabled = Boolean(accountId && accessKeyId && secretAccessKey && bucket && publicUrl);

const client = r2Enabled
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
  : null;

export const UPLOAD_DIR = path.resolve('uploads');
export const ALLOWED_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_BYTES = 5 * 1024 * 1024;

export function publicUrlFor(key) {
  return r2Enabled ? `${publicUrl}/${key}` : `/uploads/${key}`;
}

// Brauzer rasmni to'g'ridan-to'g'ri R2 ga yuklaydi (server orqali o'tmaydi)
export async function presignPut(key, contentType) {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(client, cmd, { expiresIn: 300 });
}

// Yuklangan fayl haqiqatan mavjudligi, turi va hajmini tekshirish
export async function verifyObject(key) {
  if (!r2Enabled) {
    const stat = await fs.stat(path.join(UPLOAD_DIR, key)).catch(() => null);
    return stat ? { size: stat.size } : null;
  }
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (!Object.keys(ALLOWED_TYPES).includes(head.ContentType)) return null;
    return { size: head.ContentLength || 0 };
  } catch {
    return null;
  }
}

export async function deleteObject(key) {
  try {
    if (r2Enabled) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } else {
      await fs.rm(path.join(UPLOAD_DIR, key), { force: true });
    }
  } catch (e) {
    console.warn('[storage] o\'chirib bo\'lmadi:', key, e.message);
  }
}
