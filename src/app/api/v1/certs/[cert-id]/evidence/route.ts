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

    if (authHeader.startsWith('Bearer ')) {
      const bearerSalt = authHeader.slice(7).trim()
      const formattedSalt = (
        bearerSalt.startsWith('0x') ? bearerSalt : `0x${bearerSalt}`
      ) as `0x${string}`

      if (localRecord) {
        const computed = computeHolderCommitment(
          localRecord.holder,
          formattedSalt,
        )
        if (
          computed.toLowerCase() ===
          onchain.certRaw.holderCommitment.toLowerCase()
        ) {
          isAuthorized = true
        }
      }
    }

    if (!isAuthorized) {
      const holderParam = (request.headers.get('x-holder') ||
        url.searchParams.get('holder') ||
        '') as `0x${string}`
      const deadlineStr =
        request.headers.get('x-deadline') ||
        url.searchParams.get('deadline') ||
        ''
      const sig = (request.headers.get('x-signature') ||
        url.searchParams.get('signature') ||
        '') as `0x${string}`

      if (holderParam && deadlineStr && sig) {
        const deadline = BigInt(deadlineStr)
        const now = BigInt(Math.floor(Date.now() / 1000))
        if (deadline >= now) {
          const { averRegistry } = getContractAddresses()
          const domain = getEip712Domain(10143, averRegistry)
          const validSig = await verifyTypedData({
            address: holderParam,
            domain,
            types: evidenceRequestTypes,
            primaryType: 'EvidenceRequest',
            message: {
              certId,
              holder: holderParam,
              deadline,
            },
            signature: sig,
          })

          if (
            validSig &&
            localRecord &&
            holderParam.toLowerCase() === localRecord.holder.toLowerCase()
          ) {
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

    const storedBundle = (localRecord as unknown as { evidenceBundle?: string })
      ?.evidenceBundle
    if (!storedBundle) {
      return NextResponse.json(
        { error: 'Evidence bundle not available for this certificate' },
        { status: 404 },
      )
    }

    const bundle = JSON.parse(storedBundle) as EvidenceBundle
    if (url.searchParams.get('full') === 'true' && localRecord?.salt) {
      bundle.salt = localRecord.salt
    }

    return NextResponse.json(bundle, { status: 200 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
