import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const protectedPaths = ["/interview", "/dashboard", "/coaching", "/profile", "/planner", "/resume", "/star", "/achievements"];

// Production canonical host. Vercel exposes every deploy under a stable
// alias (`preploy.vercel.app`) AND a unique per-deployment hash like
// `preploy-<hash>-samuels-projects-3cac4324.vercel.app`. NextAuth v5 sets
// the PKCE verifier cookie on whichever host the OAuth flow starts at; if
// the user begins on a hashed alias and Google redirects them back to the
// canonical alias (the only redirect URI in `AUTH_URL` and the Google
// Cloud allowlist), the cookie is invisible during the callback and auth
// dies with `InvalidCheck: pkceCodeVerifier`. Force every request to land
// on the canonical host so the cookie domain stays consistent through the
// whole OAuth round-trip.
const CANONICAL_HOST = "preploy.vercel.app";

export default auth((req) => {
  const host = req.headers.get("host") ?? "";

  // Canonical-host redirect — only on Vercel preview/deploy aliases, never
  // on localhost (dev) or custom domains.
  if (host.endsWith(".vercel.app") && host !== CANONICAL_HOST) {
    const canonical = new URL(req.url);
    canonical.host = CANONICAL_HOST;
    canonical.protocol = "https:";
    return NextResponse.redirect(canonical, 308);
  }

  const { pathname } = req.nextUrl;
  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // The matcher deliberately EXCLUDES `/`, `/privacy`, and `/terms` so
    // those statically-generated pages can serve from Vercel's edge CDN
    // without hitting a Lambda for middleware. The canonical-host
    // redirect still fires on `/login` and `/api/auth/:path*`, so the
    // OAuth round-trip can never start on a non-canonical host. A user
    // who lands on a hashed Vercel alias for the landing page will only
    // be redirected once they click sign-in.
    "/login",
    "/api/auth/:path*",
    "/interview/:path*",
    "/dashboard/:path*",
    "/coaching/:path*",
    "/profile/:path*",
    "/planner",
    "/planner/:path*",
    "/resume",
    "/resume/:path*",
    "/star",
    "/star/:path*",
    "/achievements",
    "/achievements/:path*",
  ],
};
