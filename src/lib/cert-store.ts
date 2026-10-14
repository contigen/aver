import fs from 'fs'
import path from 'path'
import type { CertificateRecord } from './types'

const getStorageDir = (): string => {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDir = path.resolve('/tmp', '.data')
    if (!fs.existsSync(tmpDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true })
      } catch {}
    }
    return tmpDir
  }
  const localDir = path.resolve(process.cwd(), '.data')
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true })
    }
    return localDir
  } catch {
    const fallbackTmp = path.resolve('/tmp', '.data')
    if (!fs.existsSync(fallbackTmp)) {
      try {
        fs.mkdirSync(fallbackTmp, { recursive: true })
      } catch {}
    }
    return fallbackTmp
  }
}

const getStorageFilePath = (): string => {
  return path.join(getStorageDir(), 'certs.json')
}

const readCertMap = (): Record<string, CertificateRecord> => {
  try {
    const filePath = getStorageFilePath()
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content) as Record<string, CertificateRecord>
    }
    const seedPath = path.resolve(process.cwd(), '.data', 'certs.json')
    if (fs.existsSync(seedPath)) {
      const content = fs.readFileSync(seedPath, 'utf-8')
      const parsed = JSON.parse(content) as Record<string, CertificateRecord>
      try {
        fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8')
      } catch {}
      return parsed
    }
    return {}
  } catch {
    return {}
  }
}

const writeCertMap = (map: Record<string, CertificateRecord>): void => {
  try {
    const filePath = getStorageFilePath()
    fs.writeFileSync(filePath, JSON.stringify(map, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to write certificate map:', err)
  }
}

export const saveCertificateRecord = (record: CertificateRecord): void => {
  const map = readCertMap()
  map[record.certId.toLowerCase()] = record
  writeCertMap(map)
}

export const getCertificateRecord = (
  certId: `0x${string}`,
): CertificateRecord | null => {
  const map = readCertMap()
  return map[certId.toLowerCase()] ?? null
}

export const getAllCertificateRecords = (): CertificateRecord[] => {
  const map = readCertMap()
  return Object.values(map)
}

const DEFAULT_TOKEN: `0x${string}` =
  '0x534b2f3A21130d7a60830c2Df862319e593943A3'

const BUILTIN_REQUIREMENTS: Record<string, import('./types').ProofRequirement> =
  {
    req_7ef01e011ec7: {
      id: 'req_7ef01e011ec7',
      title: 'Apartment Lease - Unit 4B',
      description: 'Proof required prior to signing lease agreement',
      token: DEFAULT_TOKEN,
      tokenSymbol: 'USDC',
      minAmount: '10',
      minHoldSeconds: 3600,
      requiredMode: 0,
      createdAt: 1791929989,
    },
    req_8a4728edb6ce: {
      id: 'req_8a4728edb6ce',
      title: 'Apartment Lease - Unit 4B',
      description:
        'Proof of funds required prior to lease signing or escrow deposit.',
      token: DEFAULT_TOKEN,
      tokenSymbol: 'USDC',
      minAmount: '10',
      minHoldSeconds: 3600,
      requiredMode: 0,
      createdAt: 1791940000,
    },
  }

const getReqStorageFilePath = (): string => {
  return path.join(getStorageDir(), 'requirements.json')
}

const readReqMap = (): Record<string, import('./types').ProofRequirement> => {
  const map: Record<string, import('./types').ProofRequirement> = {
    ...BUILTIN_REQUIREMENTS,
  }
  try {
    const seedPath = path.resolve(process.cwd(), '.data', 'requirements.json')
    if (fs.existsSync(seedPath)) {
      const content = fs.readFileSync(seedPath, 'utf-8')
      const parsed = JSON.parse(content) as Record<
        string,
        import('./types').ProofRequirement
      >
      Object.assign(map, parsed)
    }
  } catch {}

  try {
    const filePath = getReqStorageFilePath()
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(content) as Record<
        string,
        import('./types').ProofRequirement
      >
      Object.assign(map, parsed)
    }
  } catch {}

  return map
}

const writeReqMap = (
  map: Record<string, import('./types').ProofRequirement>,
): void => {
  try {
    const filePath = getReqStorageFilePath()
    fs.writeFileSync(filePath, JSON.stringify(map, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to write requirements map:', err)
  }
}

export const encodeRequirementId = (
  req: Omit<import('./types').ProofRequirement, 'id'>,
): string => {
  const compact = {
    t: req.title,
    d: req.description || undefined,
    m: req.minAmount,
    w: req.minHoldSeconds,
    o: req.requiredMode ?? 0,
    k: req.token,
    s: req.tokenSymbol,
    a: req.creator,
    c: req.createdAt,
  }
  const payload = Buffer.from(JSON.stringify(compact), 'utf-8').toString(
    'base64url',
  )
  return `req_${payload}`
}

export const decodeRequirementId = (
  id: string,
): import('./types').ProofRequirement | null => {
  if (!id.startsWith('req_')) return null
  const payload = id.slice(4)
  if (!payload || payload.length < 8) return null

  try {
    const jsonStr = Buffer.from(payload, 'base64url').toString('utf-8')
    const raw = JSON.parse(jsonStr) as Record<string, unknown>
    if (!raw || typeof raw !== 'object') return null

    const title = (raw.t ?? raw.title) as string | undefined
    const minAmount = (raw.m ?? raw.minAmount) as string | undefined
    const minHoldSeconds = Number(raw.w ?? raw.minHoldSeconds)

    if (!title || !minAmount || isNaN(minHoldSeconds)) return null

    const description = (raw.d ?? raw.description) as string | undefined
    const token = (raw.k ?? raw.token ?? DEFAULT_TOKEN) as `0x${string}`
    const tokenSymbol = (raw.s ?? raw.tokenSymbol ?? 'USDC') as string
    const requiredMode = Number(raw.o ?? raw.requiredMode ?? 0)
    const creator = (raw.a ?? raw.creator) as `0x${string}` | undefined
    const createdAt = Number(
      raw.c ?? raw.createdAt ?? Math.floor(Date.now() / 1000),
    )

    return {
      id,
      title: String(title),
      description: description ? String(description) : undefined,
      token,
      tokenSymbol,
      minAmount: String(minAmount),
      minHoldSeconds,
      requiredMode: requiredMode === 1 ? 1 : 0,
      creator,
      createdAt,
    }
  } catch {
    return null
  }
}

export const saveRequirement = (
  req: import('./types').ProofRequirement,
): void => {
  const map = readReqMap()
  map[req.id.toLowerCase()] = req
  writeReqMap(map)
}

export const getRequirement = (
  id: string,
): import('./types').ProofRequirement | null => {
  const map = readReqMap()
  const found = map[id.toLowerCase()]
  if (found) return found

  const decoded = decodeRequirementId(id)
  if (decoded) {
    saveRequirement(decoded)
    return decoded
  }

  return null
}

export const getAllRequirements = (): import('./types').ProofRequirement[] => {
  const map = readReqMap()
  return Object.values(map)
}
