'use client'

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { LayoutDashboard, Users, FileText, LogOut, Crown, Film, Palette, LifeBuoy } from '@/components/ui/studio-icons'
import Link from "next/link"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    } else if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/")
    }
  }, [status, session, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (session?.user?.role !== "ADMIN") {
    return null
  }

  return (
    <div className="min-h-screen bg-card text-white">
      {/* Admin Header */}
      <header className="border-b border-border bg-card/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-foreground text-foreground text-foreground">
              Admin Panel
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{session.user?.email}</span>
            <button
              onClick={() => window.location.href = '/api/auth/logout'}
              className="flex items-center gap-2 text-muted-foreground hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-[calc(100vh-73px)] border-r border-border p-4">
          <nav className="space-y-2">
            <Link
              href="/admin/users"
              className="flex items-center gap-3 px-4 py-3 rounded-sm text-muted-foreground hover:text-white hover:bg-card"
            >
              <Users className="w-5 h-5" />
              Users
            </Link>
            <Link
              href="/admin/templates"
              className="flex items-center gap-3 px-4 py-3 rounded-sm text-muted-foreground hover:text-white hover:bg-card"
            >
              <FileText className="w-5 h-5" />
              Templates
            </Link>
            <Link
              href="/admin/story-arcs"
              className="flex items-center gap-3 px-4 py-3 rounded-sm text-muted-foreground hover:text-white hover:bg-card"
            >
              <Film className="w-5 h-5" />
              Story Arcs
            </Link>
            <Link
              href="/admin/visual-styles"
              className="flex items-center gap-3 px-4 py-3 rounded-sm text-muted-foreground hover:text-white hover:bg-card"
            >
              <Palette className="w-5 h-5" />
              Visual Styles
            </Link>
            <Link
              href="/admin/premium"
              className="flex items-center gap-3 px-4 py-3 rounded-sm text-muted-foreground hover:text-white hover:bg-card"
            >
              <Crown className="w-5 h-5" />
              Premium Gates
            </Link>
            <Link
              href="/admin/support"
              className="flex items-center gap-3 px-4 py-3 rounded-sm text-muted-foreground hover:text-white hover:bg-card"
            >
              <LifeBuoy className="w-5 h-5" />
              Support
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
