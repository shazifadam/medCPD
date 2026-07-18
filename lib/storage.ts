import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Provider-agnostic file storage (Stack discipline #3).
 * Talks the S3 protocol — Supabase Storage exposes an S3-compatible
 * endpoint, as do MinIO / R2 / S3 on the fallback stack.
 * Buckets: certificates, evidence.
 */

/** Private bucket for CPD entry evidence (Database Schema Part 5d). */
export const EVIDENCE_BUCKET = "cpd-evidence";

declare global {
  // eslint-disable-next-line no-var
  var __s3: S3Client | undefined;
}

function credentials() {
  // Preferred: dedicated S3 access keys (dashboard-minted; also what
  // MinIO / R2 / S3 use on the fallback stack).
  if (process.env.S3_ACCESS_KEY_ID) {
    return {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    };
  }
  // Fallback: Supabase S3 session-token auth — accessKeyId = project ref,
  // secretAccessKey = anon key, sessionToken = service-role JWT (full
  // access, server-only). Keys can't be minted via the Management API,
  // so this keeps dev running without a manual dashboard step.
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  return {
    accessKeyId: ref,
    secretAccessKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    sessionToken: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  };
}

function createS3() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT, // e.g. https://<ref>.supabase.co/storage/v1/s3
    region: process.env.S3_REGION ?? "ap-south-1",
    credentials: credentials(),
    forcePathStyle: true, // required by Supabase Storage / MinIO
  });
}

export const s3 = globalThis.__s3 ?? createS3();
if (process.env.NODE_ENV !== "production") globalThis.__s3 = s3;

export async function uploadFile(
  bucket: string,
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
) {
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
  );
  return key;
}

/** Short-lived download URL (private buckets — evidence, certificates). */
export async function getDownloadUrl(bucket: string, key: string, expiresIn = 60 * 10) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}
