import { NextResponse } from 'next/server'
import {
  fetchOnchainStatus,
  getPublicClient,
  ensureFreshHeartbeat,
} from '@/lib/attestor'
import { getCertificateRecord } from '@/lib/cert-store'
import { erc20Abi } from '@/lib/contracts/abis'
import type { PublicCertView, VerifyDisplayStatus } from '@/lib/types'

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ 'cert-id': string }> },
) {
  try {
    const { 'cert-id': rawCertId } = await ctx.params
    const certId = (
      rawCertId.startsWith('0x') ? rawCertId : `0x${rawCertId}`
    ) as `0x${string}`

    const onchain = await fetchOnchainStatus(certId)
    if (onchain.effectiveStatus === 'Unknown') {
      return NextResponse.json(
        { error: 'Certificate not found onchain' },
        { status: 404 },
      )
    }

    const localRecord = getCertificateRecord(certId)
    const now = Math.floor(Date.now() / 1000)
    const freshHeartbeat = await ensureFreshHeartbeat(onchain.lastHeartbeat)
    const heartbeatAge = now - Number(freshHeartbeat)
    const isHeartbeatFresh = freshHeartbeat > BigInt(0) && heartbeatAge <= 1800

    const client = getPublicClient()
    const tokenSymbol = (await client
      .readContract({
        address: onchain.certRaw.token,
        abi: erc20Abi,
        functionName: 'symbol',
      })
      .catch(() => 'USDC')) as string

    let displayStatus: VerifyDisplayStatus = 'VALID'
    if (onchain.effectiveStatus === 'Breached') {
      displayStatus = 'BREACHED'
    } else if (onchain.effectiveStatus === 'Revoked') {
      displayStatus = 'REVOKED'
    } else if (onchain.effectiveStatus === 'Expired') {
      displayStatus = 'EXPIRED'
    } else if (!isHeartbeatFresh && onchain.certRaw.mode === 0) {
      displayStatus = 'STALE'
    } else if (onchain.certRaw.mode === 1) {
      displayStatus = 'LOCKED_GUARANTEED'
    }

    const reqInfo = localRecord?.requirementId
      ? (await import('@/lib/cert-store')).getRequirement(
          localRecord.requirementId,
        )
      : undefined

    const payload: PublicCertView = {
      certId,
      holderCommitment: onchain.certRaw.holderCommitment,
      evidenceHash: onchain.certRaw.evidenceHash,
      token: onchain.certRaw.token,
      tokenSymbol: tokenSymbol || 'USDC',
      threshold: onchain.certRaw.threshold.toString(),
      windowSeconds: Number(onchain.certRaw.windowSeconds),
      issuedAt: Number(onchain.certRaw.issuedAt),
      expiresAt: Number(onchain.certRaw.expiresAt),
      mode: onchain.certRaw.mode === 1 ? 'Locked' : 'Observed',
      status: onchain.effectiveStatus,
      displayStatus,
      statusAt: Number(onchain.certRaw.statusAt),
      evidenceBlock: Number(onchain.certRaw.evidenceBlock),
      lastHeartbeat: Number(freshHeartbeat),
      isHeartbeatFresh,
      anchorTxHash: localRecord?.txHash,
      requirement: reqInfo ?? undefined,
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to fetch certificate'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
