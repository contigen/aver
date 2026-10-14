import { NextResponse } from 'next/server'
import { z } from 'zod'
import { toHex } from 'viem'
import {
  saveRequirement,
  getAllRequirements,
  encodeRequirementId,
} from '@/lib/cert-store'
import { resolveAppUrl } from '@/lib/app-url'
import type { ProofRequirement } from '@/lib/types'

const createRequirementSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  token: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  tokenSymbol: z.string().min(1).max(10).optional(),
  minAmount: z.string().regex(/^[0-9]+(\.[0-9]+)?$/),
  minHoldSeconds: z.number().int().positive(),
  requiredMode: z.number().int().min(0).max(1).default(0),
  creator: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
})

export async function GET() {
  try {
    const list = getAllRequirements()
    return NextResponse.json({ requirements: list }, { status: 200 })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch requirements'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json()
    const parseResult = createRequirementSchema.safeParse(rawBody)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid requirement payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      )
    }

    const data = parseResult.data
    const defaultToken: `0x${string}` =
      '0x534b2f3A21130d7a60830c2Df862319e593943A3'

    const requirementPayload = {
      title: data.title,
      description: data.description,
      token: (data.token as `0x${string}`) || defaultToken,
      tokenSymbol: data.tokenSymbol || 'USDC',
      minAmount: data.minAmount,
      minHoldSeconds: data.minHoldSeconds,
      requiredMode: data.requiredMode,
      creator: data.creator as `0x${string}` | undefined,
      createdAt: Math.floor(Date.now() / 1000),
    }

    const id = encodeRequirementId(requirementPayload)
    const requirement: ProofRequirement = {
      id,
      ...requirementPayload,
    }

    saveRequirement(requirement)

    const appUrl = resolveAppUrl(request)
    return NextResponse.json(
      {
        id,
        url: `${appUrl}/r/${id}`,
        requirement,
      },
      { status: 201 },
    )
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to create requirement'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
