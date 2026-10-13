import { describe, expect, it } from 'bun:test'
import { verifyTypedData } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import {
  getEip712Domain,
  proofRequestTypes,
  revokeRequestTypes,
} from '../src/lib/eip712'

describe('EIP-712 Typed Data Verification', () => {
  const chainId = 10143
  const registry = '0x2222222222222222222222222222222222222222' as `0x${string}`
  const token = '0x1111111111111111111111111111111111111111' as `0x${string}`

  it('should sign and verify valid ProofRequest', async () => {
    const privKey = generatePrivateKey()
    const account = privateKeyToAccount(privKey)
    const domain = getEip712Domain(chainId, registry)

    const message = {
      holder: account.address,
      token,
      threshold: BigInt(5000000000),
      windowSeconds: BigInt(604800),
      mode: 0,
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 604800),
      nonce:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    }

    const signature = await account.signTypedData({
      domain,
      types: proofRequestTypes,
      primaryType: 'ProofRequest',
      message,
    })

    const isValid = await verifyTypedData({
      address: account.address,
      domain,
      types: proofRequestTypes,
      primaryType: 'ProofRequest',
      message,
      signature,
    })

    expect(isValid).toBe(true)
  })

  it('should reject tampered message parameters', async () => {
    const privKey = generatePrivateKey()
    const account = privateKeyToAccount(privKey)
    const domain = getEip712Domain(chainId, registry)

    const message = {
      holder: account.address,
      token,
      threshold: BigInt(5000000000),
      windowSeconds: BigInt(604800),
      mode: 0,
      expiresAt: BigInt(1800000000),
      nonce:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`,
      deadline: BigInt(1800003600),
    }

    const signature = await account.signTypedData({
      domain,
      types: proofRequestTypes,
      primaryType: 'ProofRequest',
      message,
    })

    const tamperedMessage = {
      ...message,
      threshold: BigInt(1000000000),
    }

    const isValid = await verifyTypedData({
      address: account.address,
      domain,
      types: proofRequestTypes,
      primaryType: 'ProofRequest',
      message: tamperedMessage,
      signature,
    })

    expect(isValid).toBe(false)
  })

  it('should sign and verify valid RevokeRequest', async () => {
    const privKey = generatePrivateKey()
    const account = privateKeyToAccount(privKey)
    const domain = getEip712Domain(chainId, registry)

    const message = {
      certId:
        '0xaaaabbbbccccddddaaaabbbbccccddddaaaabbbbccccddddaaaabbbbccccdddd' as `0x${string}`,
      holder: account.address,
      nonce:
        '0x5555555555555555555555555555555555555555555555555555555555555555' as `0x${string}`,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    }

    const signature = await account.signTypedData({
      domain,
      types: revokeRequestTypes,
      primaryType: 'RevokeRequest',
      message,
    })

    const isValid = await verifyTypedData({
      address: account.address,
      domain,
      types: revokeRequestTypes,
      primaryType: 'RevokeRequest',
      message,
      signature,
    })

    expect(isValid).toBe(true)
  })
})
