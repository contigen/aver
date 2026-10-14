import { NextResponse } from 'next/server'
import { verifyTypedData } from 'viem'
import { computeHolderCommitment, fetchOnchainStatus } from '@/lib/attestor'
import { getContractAddresses } from '@/lib/chain-config'
import { getCertificateRecord } from '@/lib/cert-store'
import { getEip712Domain, evidenceRequestTypes } from '@/lib/eip712'
import type { EvidenceBundle } from '@/lib/types'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ 'cert-id': string }> },
) {
  try {
    const { 'cert-id': rawCertId } = await ctx.params
    const certId = (
      rawCertId.startsWith('0x') ? rawCertId : `0x${rawCertId}`
    ) as `0x${string}`

    const localRecord = getCertificateRecord(certId)
    const onchain = await fetchOnchainStatus(certId)

    if (onchain.effectiveStatus === 'Unknown') {
      return NextResponse.json(
        { error: 'Certificate not found onchain' },
        { status: 404 },
      )
    }

    const authHeader = request.headers.get('Authorization') || ''
    const url = new URL(request.url)
    let isAuthorized = false

    const rawSalt = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : url.searchParams.get('salt') || ''
    let formattedSalt: `0x${string}` | null = null
    if (rawSalt) {
      formattedSalt = (
        rawSalt.startsWith('0x') ? rawSalt : `0x${rawSalt}`
      ) as `0x${string}`
    }

    const candidateHolder = (request.headers.get('x-holder') ||
      url.searchParams.get('holder') ||
      localRecord?.holder ||
      '') as `0x${string}`

    if (formattedSalt && candidateHolder) {
      const computed = computeHolderCommitment(candidateHolder, formattedSalt)
      if (
        computed.toLowerCase() ===
        onchain.certRaw.holderCommitment.toLowerCase()
      ) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      const deadlineStr =
        request.headers.get('x-deadline') ||
        url.searchParams.get('deadline') ||
        ''
      const sig = (request.headers.get('x-signature') ||
        url.searchParams.get('signature') ||
        '') as `0x${string}`

      if (candidateHolder && deadlineStr && sig) {
        const deadline = BigInt(deadlineStr)
        const now = BigInt(Math.floor(Date.now() / 1000))
        if (deadline >= now) {
          const { averRegistry } = getContractAddresses()
          const domain = getEip712Domain(10143, averRegistry)
          const validSig = await verifyTypedData({
            address: candidateHolder,
            domain,
            types: evidenceRequestTypes,
            primaryType: 'EvidenceRequest',
            message: {
              certId,
              holder: candidateHolder,
              deadline,
            },
            signature: sig,
          })

          if (validSig) {
            isAuthorized = true
          }
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        {
          error:
            'Unauthorized: valid bearer salt or signed EIP-712 EvidenceRequest required',
        },
        { status: 401 },
      )
    }

    let bundle: EvidenceBundle | null = null
    const storedBundle = (localRecord as unknown as { evidenceBundle?: string })
      ?.evidenceBundle

    if (storedBundle) {
      bundle = JSON.parse(storedBundle) as EvidenceBundle
    } else if (onchain.certRaw.mode === 1) {
      bundle = {
        v: 1,
        chainId: '10143',
        token: onchain.certRaw.token.toLowerCase(),
        tokenDeployBlock: '70678272',
        windowStartBlock: onchain.certRaw.statusAt.toString(),
        issuedAtBlock: onchain.certRaw.statusAt.toString(),
        holder: candidateHolder.toLowerCase(),
        transfers: [],
        result: {
          minBalance: onchain.certRaw.threshold.toString(),
          heldSince: onchain.certRaw.issuedAt.toString(),
          threshold: onchain.certRaw.threshold.toString(),
          conditionMet: true,
        },
      }
    } else {
      return NextResponse.json(
        { error: 'Evidence bundle not available for this certificate' },
        { status: 404 },
      )
    }

    if (
      url.searchParams.get('full') === 'true' &&
      (formattedSalt || localRecord?.salt)
    ) {
      bundle.salt = formattedSalt || localRecord?.salt
    }

    return NextResponse.json(bundle, { status: 200 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
