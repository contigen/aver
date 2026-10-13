import { NextResponse } from 'next/server'
import {
  fetchOnchainStatus,
  fetchTokenBalance,
  markBreachedOnchain,
  getPublicClient,
} from '@/lib/attestor'
import { getCertificateRecord } from '@/lib/cert-store'

export async function POST(
  request: Request,
  ctx: { params: Promise<{ 'cert-id': string }> },
) {
  try {
    const { 'cert-id': rawCertId } = await ctx.params
    const certId = (
      rawCertId.startsWith('0x') ? rawCertId : `0x${rawCertId}`
    ) as `0x${string}`

    let bodyHolder: `0x${string}` | null = null
    try {
      const body = (await request.json()) as { holder?: string }
      if (body?.holder && body.holder.startsWith('0x')) {
        bodyHolder = body.holder as `0x${string}`
      }
    } catch {
      bodyHolder = null
    }

    const onchain = await fetchOnchainStatus(certId)
    if (onchain.effectiveStatus === 'Unknown') {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 },
      )
    }

    if (onchain.effectiveStatus !== 'Active') {
      return NextResponse.json({
        status: onchain.effectiveStatus,
        message: 'Certificate is not currently active',
      })
    }

    if (onchain.certRaw.mode === 1) {
      return NextResponse.json({
        status: 'Locked',
        message: 'Locked certificates cannot be breached while in vault',
      })
    }

    const record = getCertificateRecord(certId)
    const targetHolder = bodyHolder || record?.holder

    if (!targetHolder) {
      return NextResponse.json(
        { error: 'Holder address required for verification' },
        { status: 400 },
      )
    }

    const balance = await fetchTokenBalance(targetHolder, onchain.certRaw.token)

    if (balance < onchain.certRaw.threshold) {
      const client = getPublicClient()
      const currentBlock = await client.getBlockNumber()
      const txHash = await markBreachedOnchain(certId, currentBlock)

      return NextResponse.json({
        breached: true,
        currentBalance: balance.toString(),
        threshold: onchain.certRaw.threshold.toString(),
        evidenceBlock: currentBlock.toString(),
        txHash,
      })
    }

    return NextResponse.json({
      breached: false,
      currentBalance: balance.toString(),
      threshold: onchain.certRaw.threshold.toString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Breach check failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
