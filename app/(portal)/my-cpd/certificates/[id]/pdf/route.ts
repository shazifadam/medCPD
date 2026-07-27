import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getIdentity, hasRole } from "@/lib/auth/identity";
import { getCertificate, CERTIFICATES_BUCKET } from "@/lib/certificates";
import { renderCertificatePdf } from "@/lib/certificate-pdf";
import { uploadFile, getDownloadUrl } from "@/lib/storage";

// @react-pdf/renderer requires Node (schema design note: render in Node, not Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Download the rendered certificate PDF. First hit renders + uploads to the
 * private cpd-certificates bucket and stamps storage_bucket/path on the row
 * (schema: row first, render async after); later hits just re-sign the URL.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const identity = await getIdentity();
  if (!identity) return new NextResponse("Unauthorized", { status: 401 });

  const cert = await getCertificate(params.id);
  if (!cert) return new NextResponse("Not found", { status: 404 });

  const elevated =
    hasRole(identity, "mma_admin") || hasRole(identity, "cpd_committee");
  if (cert.practitionerId !== identity.user.id && !elevated) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let bucket = cert.storageBucket;
  let key = cert.storagePath;
  if (!bucket || !key) {
    const pdf = await renderCertificatePdf(cert);
    bucket = CERTIFICATES_BUCKET;
    key = `${cert.practitionerId}/${cert.certificateNumber}.pdf`;
    await uploadFile(bucket, key, pdf, "application/pdf");
    await sql`
      update certificates
      set storage_bucket = ${bucket}, storage_path = ${key}
      where id = ${cert.id}
    `;
  }

  const url = await getDownloadUrl(bucket, key);
  return NextResponse.redirect(url);
}
