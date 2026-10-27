import { auth } from "@/lib/auth"
import { syncUser } from "@/lib/user-sync"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userData = await syncUser(session.user)
  return NextResponse.json(userData)
}

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userData = await syncUser(session.user)
  return NextResponse.json(userData)
}
