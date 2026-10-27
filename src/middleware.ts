import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"  // ✅ Edge-safe, no Prisma
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

const protectedRoutes = ["/admin", "/content-manager"]
const publicRoutes = ["/auth", "/api/auth", "/api/db"]

export default auth(async function middleware(request) {
  const session = request.auth
  const isLoggedIn = !!session
  const pathname = new URL(request.url).pathname

  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Protect admin routes
  if (
    protectedRoutes.some(
      route => pathname === route || pathname.startsWith(route + "/")
    ) &&
    !isLoggedIn
  ) {
    return NextResponse.redirect(new URL("/auth/signin", request.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
}