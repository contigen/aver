export const EIP712_DOMAIN_NAME = 'Aver'
export const EIP712_DOMAIN_VERSION = '1'

export const getEip712Domain = (
  chainId: number,
  verifyingContract: `0x${string}`,
) => ({
  name: EIP712_DOMAIN_NAME,
  version: EIP712_DOMAIN_VERSION,
  chainId,
  verifyingContract,
})

export const proofRequestTypes = {
  ProofRequest: [
    { name: 'holder', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'threshold', type: 'uint256' },
    { name: 'windowSeconds', type: 'uint64' },
    { name: 'mode', type: 'uint8' },
    { name: 'expiresAt', type: 'uint64' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const

export const revokeRequestTypes = {
  RevokeRequest: [
    { name: 'certId', type: 'bytes32' },
    { name: 'holder', type: 'address' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const

export const evidenceRequestTypes = {
  EvidenceRequest: [
    { name: 'certId', type: 'bytes32' },
    { name: 'holder', type: 'address' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const
