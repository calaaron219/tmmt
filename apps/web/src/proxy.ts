import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Next.js 16 renamed middleware.ts → proxy.ts. Same idea: runs on every
// matched request before the route renders, can redirect or rewrite.
// Here we redirect unauthenticated users away from /app/* to /login.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnApp = req.nextUrl.pathname.startsWith("/app");

  if (isOnApp && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*"],
};
