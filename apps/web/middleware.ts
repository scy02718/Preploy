import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const protectedPaths = ["/interview", "/dashboard", "/coaching", "/profile", "/planner", "/resume"];

export default auth((req) => {
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
  matcher: ["/interview/:path*", "/dashboard/:path*", "/coaching/:path*", "/profile/:path*", "/planner", "/planner/:path*", "/resume", "/resume/:path*"],
};
