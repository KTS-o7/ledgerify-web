import { auth } from '@/lib/auth/config'
import { NextRequest, NextResponse } from 'next/server'

export async function resolveSession(
  _req: NextRequest,
): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { userId: session.user.id }
}
