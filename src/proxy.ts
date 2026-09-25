import { type NextRequest, NextResponse } from "next/server";

// Optimistic check only (no DB): bounce visitors without a session cookie to /login.
// Real authentication/authorization happens in layouts, pages, and services.
const SESSION_COOKIE = "hk_session";
const PUBLIC_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isPublic || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Skip static files, images, metadata files, and brand assets.
  matcher: ["/((?!_next/static|_next/image|brand/|icon\\.svg|manifest\\.webmanifest|favicon\\.ico|robots\\.txt).*)"],
};
