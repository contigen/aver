import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyTypedData } from 'viem'
import { revokeOnchainCertificate } from '@/lib/attestor'
import { getContractAddresses } from '@/lib/chain-config'
import { getCertificateRecord } from '@/lib/cert-store'
import { getEip712Domain, revokeRequestTypes } from '@/lib/eip712'

const revokeSchema = z.object({
  holder: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  nonce: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  deadline: z.number().int().positive(),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/),
})

export async function POST(
  request: Request,
  ctx: { params: Promise<{ 'cert-id': string }> },
) {
  try {
    const { 'cert-id': rawCertId } = await ctx.params
    const certId = (
      rawCertId.startsWith('0x') ? rawCertId : `0x${rawCertId}`
    ) as `0x${string}`

    const rawBody: unknown = await request.json()
    const parseResult = revokeSchema.safeParse(rawBody)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid revocation payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      )
    }

    const { holder, nonce, deadline, signature } = parseResult.data
    const now = Math.floor(Date.now() / 1000)

    if (deadline < now) {
      return NextResponse.json(
        { error: 'Revocation request deadline expired' },
        { status: 400 },
      )
    }

    const record = getCertificateRecord(certId)
    if (record && record.holder.toLowerCase() !== holder.toLowerCase()) {
      return NextResponse.json(
        { error: 'Signer address does not match certificate holder' },
        { status: 403 },
      )
    }

    const { averRegistry } = getContractAddresses()
    const domain = getEip712Domain(10143, averRegistry)

    const isSignatureValid = await verifyTypedData({
      address: holder as `0x${string}`,
      domain,
      types: revokeRequestTypes,
      primaryType: 'RevokeRequest',
      message: {
        certId,
        holder: holder as `0x${string}`,
        nonce: nonce as `0x${string}`,
        deadline: BigInt(deadline),
      },
      signature: signature as `0x${string}`,
    })

    if (!isSignatureValid) {
      return NextResponse.json(
        { error: 'Invalid revocation signature' },
        { status: 401 },
      )
    }

    const txHash = await revokeOnchainCertificate(certId)
    return NextResponse.json({ success: true, txHash }, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Revocation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
