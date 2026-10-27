import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { syncUser } from "@/lib/user-sync"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "Reviewer Account",
      credentials: {
        username: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Dedicated test account for OpenAI reviewers
        if (
          credentials?.username === "openai_reviewer@skygen.salru.in" &&
          credentials?.password === "SkygenReview2026!"
        ) {
          return {
            id: "openai_reviewer_1",
            name: "OpenAI Reviewer",
            email: "openai_reviewer@skygen.salru.in",
            image: "https://www.gravatar.com/avatar/?d=mp",
          }
        }
        return null
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      const userId = account?.providerAccountId || user.id

      if (!userId) return false

      const result = await syncUser({
        id: userId,
        email: user.email,
        name: user.name,
        image: user.image,
      })

      // Block deleted or banned users from signing in
      if (result?.blocked) return false

      return true
    },
    async jwt({ token, account }) {
      // Keep the stable Google account id on the token.
      if (account?.providerAccountId) {
        token.sub = account.providerAccountId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub

        try {
          const result = await syncUser({
            id: token.sub,
            email: session.user.email,
            name: session.user.name,
            image: session.user.image,
          })

          // Block deleted/banned users — invalidates existing sessions too
          if (result?.blocked) return null as any

          // Use the canonical DB id (may differ from providerAccountId if the
          // user had a previous account merged by email)
          if (result.id) session.user.id = result.id
          session.user.role = result.role || "USER"
          session.user.videoCount = result.videoCount || 0
          session.user.videoLimit = result.videoLimit || 10
        } catch (e) {
          console.error("Session error:", e)
          session.user.role = "USER"
          session.user.videoCount = 0
          session.user.videoLimit = 10
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
})

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: "ADMIN" | "USER"
      videoCount: number
      videoLimit: number
    }
  }
}
