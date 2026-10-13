import { describe, expect, it } from 'bun:test'
import { computeCertId, computeHolderCommitment } from '../src/lib/attestor'
import {
  isContractsConfigured,
  type ContractAddresses,
} from '../src/lib/chain-config'

describe('Attestor Cryptographic Functions', () => {
  it('should compute deterministic holder commitment', () => {
    const holder = '0x1111111111111111111111111111111111111111' as `0x${string}`
    const salt =
      '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`

    const commitment1 = computeHolderCommitment(holder, salt)
    const commitment2 = computeHolderCommitment(holder, salt)

    expect(commitment1).toBe(commitment2)
    expect(commitment1.startsWith('0x')).toBe(true)
    expect(commitment1.length).toBe(66)
  })

  it('should produce distinct commitments for different salts', () => {
    const holder = '0x1111111111111111111111111111111111111111' as `0x${string}`
    const salt1 =
      '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`
    const salt2 =
      '0x0000000000000000000000000000000000000000000000000000000000000002' as `0x${string}`

    const commitment1 = computeHolderCommitment(holder, salt1)
    const commitment2 = computeHolderCommitment(holder, salt2)

    expect(commitment1).not.toBe(commitment2)
  })

  it('should compute deterministic certId matching MIP-8 parameters', () => {
    const chainId = 10143
    const registry =
      '0x2222222222222222222222222222222222222222' as `0x${string}`
    const holderCommitment =
      '0x3333333333333333333333333333333333333333333333333333333333333333' as `0x${string}`
    const nonce =
      '0x4444444444444444444444444444444444444444444444444444444444444444' as `0x${string}`

    const certId1 = computeCertId(chainId, registry, holderCommitment, nonce)
    const certId2 = computeCertId(chainId, registry, holderCommitment, nonce)

    expect(certId1).toBe(certId2)
    expect(certId1.startsWith('0x')).toBe(true)
    expect(certId1.length).toBe(66)
  })

  it('should correctly identify configured vs unconfigured contracts', () => {
    const unconfigured: ContractAddresses = {
      usdc: '0x0000000000000000000000000000000000000000',
      mockUsdc: '0x0000000000000000000000000000000000000000',
      lockVault: '0x0000000000000000000000000000000000000000',
      averRegistry: '0x0000000000000000000000000000000000000000',
    }
    expect(isContractsConfigured(unconfigured)).toBe(false)

    const partiallyConfigured: ContractAddresses = {
      usdc: '0x1111111111111111111111111111111111111111',
      mockUsdc: '0x1111111111111111111111111111111111111111',
      lockVault: '0x0000000000000000000000000000000000000000',
      averRegistry: '0x2222222222222222222222222222222222222222',
    }
    expect(isContractsConfigured(partiallyConfigured)).toBe(false)

    const configured: ContractAddresses = {
      usdc: '0x1111111111111111111111111111111111111111',
      mockUsdc: '0x1111111111111111111111111111111111111111',
      lockVault: '0x2222222222222222222222222222222222222222',
      averRegistry: '0x3333333333333333333333333333333333333333',
    }
    expect(isContractsConfigured(configured)).toBe(true)
  })
})
