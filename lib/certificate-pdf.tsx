import "server-only";
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { CertificateDetail } from "@/lib/certificates";

/**
 * Certificate PDF (CT2/CT3 paper, Part 7a renderer). Node runtime only.
 * Colors are literal hex resolved from the Light design tokens — react-pdf
 * can't read CSS variables. Fonts: built-in Helvetica/Courier stand in for
 * Geist/JetBrains Mono (self-hosted font embedding is a P8 polish item).
 */

const BLUE = "#065BA1"; // primary / accent-9
const GREEN = "#067A63"; // green-11 (success-subtle-foreground)
const TEXT = "#1F1F1F"; // gray-12
const MUTED = "#595959"; // gray-11
const BORDER = "#D9D9D9"; // gray-6

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    color: TEXT,
    fontSize: 11,
  },
  frame: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 36,
    paddingHorizontal: 48,
    alignItems: "center",
  },
  topRule: { width: 84, height: 4, marginBottom: 24 },
  brand: { fontSize: 13, letterSpacing: 4, fontFamily: "Helvetica-Bold" },
  brandSub: { fontSize: 9, color: MUTED, marginTop: 4 },
  heading: {
    fontSize: 20,
    letterSpacing: 3,
    fontFamily: "Helvetica-Bold",
    marginTop: 28,
  },
  certify: { fontSize: 10, color: MUTED, marginTop: 24 },
  name: { fontSize: 24, fontFamily: "Helvetica-Bold", marginTop: 8 },
  action: { fontSize: 10, color: MUTED, marginTop: 10 },
  subject: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 6 },
  meta: { fontSize: 9.5, color: MUTED, marginTop: 6 },
  award: {
    fontSize: 10.5,
    marginTop: 22,
    textAlign: "center",
    maxWidth: 420,
    lineHeight: 1.5,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  signBlock: { alignItems: "flex-start" },
  signLine: { width: 150, borderBottomWidth: 1, borderBottomColor: TEXT },
  signLabel: { fontSize: 8.5, color: MUTED, marginTop: 6 },
  qrBlock: { alignItems: "center" },
  qr: { width: 64, height: 64 },
  qrLabel: { fontSize: 7.5, color: MUTED, marginTop: 4 },
  certId: {
    fontFamily: "Courier",
    fontSize: 9,
    color: MUTED,
    marginTop: 16,
    textAlign: "center",
    width: "100%",
  },
});

function CertificateDoc({
  cert,
  qrDataUrl,
}: {
  cert: CertificateDetail;
  qrDataUrl: string;
}) {
  const isEvent = cert.kind === "event_attendance";
  const tone = isEvent ? BLUE : GREEN;
  const p = cert.payload;
  const fmt = (d: string | null | undefined) =>
    d
      ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      : "";
  const credit = isEvent ? p?.credits?.[0] : null;

  return (
    <Document title={cert.certificateNumber}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <View style={[styles.topRule, { backgroundColor: tone }]} />
          <Text style={styles.brand}>GRADUS CPD</Text>
          <Text style={styles.brandSub}>Maldivian Medical Association</Text>
          <Text style={[styles.heading, { color: tone }]}>
            {isEvent ? "CERTIFICATE OF ATTENDANCE" : "CERTIFICATE OF COMPLETION"}
          </Text>
          <Text style={styles.certify}>This is to certify that</Text>
          <Text style={styles.name}>{p?.practitioner?.display_name}</Text>
          <Text style={styles.action}>
            {isEvent
              ? "has attended and completed"
              : "has successfully completed the continuing professional development cycle"}
          </Text>
          <Text style={styles.subject}>
            {isEvent ? p?.event?.title : p?.cycle?.name}
          </Text>
          <Text style={styles.meta}>
            {isEvent
              ? `held on ${fmt(p?.event?.starts_on)}${p?.event?.venue ? ` · ${p.event.venue}` : ""}`
              : `${fmt(p?.cycle?.starts_on)} – ${fmt(p?.cycle?.ends_on)}`}
          </Text>
          <Text style={styles.award}>
            {isEvent
              ? `Awarded ${credit?.credits} CPD credits (${credit?.category_name ?? credit?.category_code}) under the MMA Continuing Professional Development Framework.`
              : `Achieved ${p?.totals?.earned} of ${p?.totals?.required} required CPD credits and satisfied all category floor requirements under the MMA Continuing Professional Development Framework.`}
          </Text>
          <View style={styles.footer}>
            <View style={styles.signBlock}>
              <View style={styles.signLine} />
              <Text style={styles.signLabel}>Registrar, MMA CPD Committee</Text>
            </View>
            <View style={styles.qrBlock}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image style={styles.qr} src={qrDataUrl} />
              <Text style={styles.qrLabel}>Scan to verify</Text>
            </View>
          </View>
          <Text style={styles.certId}>
            Certificate ID: {cert.certificateNumber}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(
  cert: CertificateDetail
): Promise<Buffer> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const qrDataUrl = await QRCode.toDataURL(
    `${appUrl}/verify/${cert.certificateNumber}`,
    { margin: 0, width: 256 }
  );
  return renderToBuffer(<CertificateDoc cert={cert} qrDataUrl={qrDataUrl} />);
}
