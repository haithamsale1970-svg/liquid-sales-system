import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("sohob_session")?.value;

  const isAuthRoute =
    pathname.startsWith("/api/auth/") ||
    pathname === "/login" ||
    pathname === "/api/health" ||
    pathname === "/api/setup";

  if (!token && !isAuthRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|images|api/health).*)"],
};
