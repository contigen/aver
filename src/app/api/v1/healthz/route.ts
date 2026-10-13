import { NextResponse } from 'next/server'
import { getPublicClient } from '@/lib/attestor'
import { getContractAddresses } from '@/lib/chain-config'
import { averRegistryAbi } from '@/lib/contracts/abis'

export async function GET() {
  try {
    const client = getPublicClient()
    const { averRegistry } = getContractAddresses()

    const lastHeartbeat = (await client.readContract({
      address: averRegistry,
      abi: averRegistryAbi,
      functionName: 'lastHeartbeat',
    })) as bigint

    const now = Math.floor(Date.now() / 1000)
    const ageSeconds = now - Number(lastHeartbeat)
    const isHealthy = lastHeartbeat > BigInt(0) && ageSeconds <= 120

    return NextResponse.json(
      {
        status: isHealthy ? 'healthy' : 'degraded',
        lastHeartbeat: Number(lastHeartbeat),
        heartbeatAgeSeconds: ageSeconds,
        staleThresholdSeconds: 120,
      },
      { status: 200 },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Health check failed'
    return NextResponse.json(
      { status: 'error', error: message },
      { status: 503 },
    )
  }
}
