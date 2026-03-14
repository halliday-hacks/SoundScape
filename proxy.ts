import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const unauthRoutes = ["/sign-in", "/sign-up", "/reset-password", "/soundsoil", "/api/soundsoil"];

// THIS IS NOT SECURE!
// This is the recommended approach to optimistically redirect users
// We recommend handling auth checks in each page/route
export default async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const isUnauthRoute = unauthRoutes.includes(request.nextUrl.pathname);

  if (isUnauthRoute) {
    return NextResponse.next();
  }

  if (!sessionCookie) {
    console.log("middleware redirecting to sign-in");
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except static assets and ALL api routes
  matcher: ["/((?!.*\\..*|_next|api).+)", "/trpc(.*)"],
};
