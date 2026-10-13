import { NextResponse } from 'next/server'
import { fetchOnchainStatus, getPublicClient } from '@/lib/attestor'
import { getCertificateRecord } from '@/lib/cert-store'
import { generateCertificatePdf } from '@/lib/pdf-generator'
import { resolveAppUrl } from '@/lib/app-url'
import { erc20Abi } from '@/lib/contracts/abis'
import type { PublicCertView, VerifyDisplayStatus } from '@/lib/types'

export async function GET(
  request: Request,
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
    const heartbeatAge = now - Number(onchain.lastHeartbeat)
    const isHeartbeatFresh =
      onchain.lastHeartbeat > BigInt(0) && heartbeatAge <= 120

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

    const certView: PublicCertView = {
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
      lastHeartbeat: Number(onchain.lastHeartbeat),
      isHeartbeatFresh,
      anchorTxHash: localRecord?.txHash,
    }

    const appUrl = resolveAppUrl(request)
    const verifyUrl = `${appUrl}/v/${certId}`
    const pdfBytes = await generateCertificatePdf(certView, verifyUrl)

    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="aver-certificate-${certId.slice(0, 10)}.pdf"`,
      },
    })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to generate PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
