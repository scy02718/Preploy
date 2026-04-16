import Link from "next/link";

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-background py-8 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>© {year} Preploy. All rights reserved.</p>
        <nav className="flex items-center gap-6" aria-label="Footer navigation">
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <a
            href="mailto:preploy.dev@gmail.com"
            className="hover:text-foreground transition-colors"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
