import Image from "next/image";
import Link from "next/link";

/**
 * Auth shell — AU flow (Figma AU1–AU9): centered card on the brand
 * gradient backdrop, Gradus lockup above, legal footer below.
 * Footer placement follows AU2 (AU1's frame has the footer overlapping
 * the button — a design glitch, deviation noted).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--success-subtle)) 0%, hsl(var(--accent-1)) 45%, hsl(var(--accent-4)) 100%)",
      }}
    >
      <main className="flex w-full flex-col items-center gap-8">
        <Image
          src="/logo.svg"
          alt="Gradus CPD System"
          width={334}
          height={40}
          priority
        />
        {/* Pages own their card (AuthCard) — AU3/AU7/AU8 place headings
            OUTSIDE the card, so the shell can't hard-wrap children. */}
        {children}
      </main>
      <footer className="mt-12 flex flex-col items-center gap-1 text-xs">
        <div className="flex items-center gap-4">
          <Link
            href="/privacy"
            className="text-muted-foreground hover:text-foreground"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-muted-foreground hover:text-foreground"
          >
            Terms &amp; Conditions
          </Link>
        </div>
        <p className="text-muted-foreground/70">
          2026 © Maldivian Medical Association
        </p>
      </footer>
    </div>
  );
}
