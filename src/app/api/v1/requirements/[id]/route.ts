import { NextResponse } from 'next/server'
import { getRequirement } from '@/lib/cert-store'

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const requirement = getRequirement(id)

    if (!requirement) {
      return NextResponse.json(
        { error: 'Requirement not found' },
        { status: 404 },
      )
    }

    return NextResponse.json(requirement, { status: 200 })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch requirement'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
