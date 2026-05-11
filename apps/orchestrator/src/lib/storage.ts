import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'node:crypto';
import { env } from '../config';

let _s3: S3Client | undefined;

function s3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: true, // required for MinIO
    });
  }
  return _s3;
}

export async function uploadAsset(input: {
  key: string;
  body: Buffer;
  mime: string;
  bucket?: string;
}): Promise<{ bucket: string; key: string; sizeBytes: number; checksum: string }> {
  const bucket = input.bucket ?? env.S3_BUCKET;
  const checksum = sha256(input.body);

  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.mime,
    }),
  );

  return {
    bucket,
    key: input.key,
    sizeBytes: input.body.length,
    checksum,
  };
}

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function signedDownloadUrl(
  bucket: string,
  key: string,
  ttlSec = 30 * 60,
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3(), cmd, { expiresIn: ttlSec });
}
