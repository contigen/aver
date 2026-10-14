export type ProofMode = 'Observed' | 'Locked'

export type StoredStatus = 'Active' | 'Breached' | 'Revoked'

export type EffectiveStatus =
  'Unknown' | 'Active' | 'Breached' | 'Revoked' | 'Expired'

export type VerifyDisplayStatus =
  'VALID' | 'BREACHED' | 'EXPIRED' | 'REVOKED' | 'STALE' | 'LOCKED_GUARANTEED'

export type CertificateData = {
  certId: `0x${string}`
  holderCommitment: `0x${string}`
  evidenceHash: `0x${string}`
  token: `0x${string}`
  threshold: bigint
  windowSeconds: bigint
  issuedAt: bigint
  expiresAt: bigint
  mode: number
  status: number
  statusAt: bigint
  evidenceBlock: bigint
}

export type ProofRequest = {
  holder: `0x${string}`
  token: `0x${string}`
  threshold: bigint
  windowSeconds: bigint
  mode: number
  expiresAt: bigint
  nonce: `0x${string}`
  deadline: bigint
}

export type CertificateRecord = {
  certId: `0x${string}`
  holder: `0x${string}`
  salt: `0x${string}`
  evidenceHash: `0x${string}`
  token: `0x${string}`
  threshold: string
  windowSeconds: number
  issuedAt: number
  expiresAt: number
  mode: number
  txHash: `0x${string}`
  createdAt: number
  requirementId?: string
}

export type ProofRequirement = {
  id: string
  title: string
  description?: string
  token: `0x${string}`
  tokenSymbol: string
  minAmount: string
  minHoldSeconds: number
  requiredMode: number
  creator?: `0x${string}`
  createdAt: number
}

export type TimelineResult = {
  currentBalance: bigint
  minBalance: bigint
  heldSince: bigint
  meetsThreshold: boolean
  historyLength: number
}

export type RevealPayload = {
  address: `0x${string}`
  salt: `0x${string}`
}

export type IssueProofRequestBody = {
  proofRequest: {
    holder: `0x${string}`
    token: `0x${string}`
    threshold: string
    windowSeconds: number
    mode: number
    expiresAt: number
    nonce: `0x${string}`
    deadline: number
  }
  signature: `0x${string}`
  requirementId?: string
}

export type IssueProofResponse = {
  certId: `0x${string}`
  salt: `0x${string}`
  txHash: `0x${string}`
  pdfUrl: string
  verifyUrl: string
  evidenceBundle?: EvidenceBundle
}

export type PublicCertView = {
  certId: `0x${string}`
  holderCommitment: `0x${string}`
  evidenceHash: `0x${string}`
  token: `0x${string}`
  tokenSymbol: string
  threshold: string
  windowSeconds: number
  issuedAt: number
  expiresAt: number
  mode: ProofMode
  status: EffectiveStatus
  displayStatus: VerifyDisplayStatus
  statusAt: number
  evidenceBlock: number
  lastHeartbeat: number
  isHeartbeatFresh: boolean
  anchorTxHash?: `0x${string}`
  requirement?: ProofRequirement
}

export type EvidenceTransfer = {
  block: string
  logIndex: string
  from: string
  to: string
  value: string
}

export type EvidenceResult = {
  minBalance: string
  heldSince: string
  threshold: string
  conditionMet: boolean
}

export type EvidenceBundle = {
  v: number
  chainId: string
  token: string
  tokenDeployBlock: string
  windowStartBlock: string
  issuedAtBlock: string
  holder: string
  transfers: EvidenceTransfer[]
  result: EvidenceResult
  salt?: string
}

export type EvidenceVerificationStep = {
  name: string
  passed: boolean
  optional?: boolean
  message: string
}

export type EvidenceVerificationReport = {
  passed: boolean
  steps: EvidenceVerificationStep[]
}
