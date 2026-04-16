import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const protectedPaths = ["/interview", "/dashboard", "/coaching", "/profile", "/planner", "/resume", "/star"];

// Production canonical host. All traffic must land on this domain so
// NextAuth's PKCE verifier cookie stays on a consistent domain through
// the OAuth round-trip. Requests from Vercel aliases (*.vercel.app) and
// the old preploy.vercel.app are 308-redirected here.
const CANONICAL_HOST = "preploy.tech";

export default auth((req) => {
  const host = req.headers.get("host") ?? "";

  // Canonical-host redirect — Vercel deploy aliases AND any non-canonical
  // host that isn't localhost. This covers preploy.vercel.app, hash aliases,
  // and any stale bookmarks.
  if (
    host !== CANONICAL_HOST &&
    !host.startsWith("localhost") &&
    !host.startsWith("127.0.0.1") &&
    (host.endsWith(".vercel.app") || host.endsWith(".vercel.sh"))
  ) {
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
  ],
};
