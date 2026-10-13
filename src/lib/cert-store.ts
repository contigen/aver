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

const getReqStorageFilePath = (): string => {
  return path.join(getStorageDir(), 'requirements.json')
}

const readReqMap = (): Record<string, import('./types').ProofRequirement> => {
  try {
    const filePath = getReqStorageFilePath()
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content) as Record<
        string,
        import('./types').ProofRequirement
      >
    }
    const seedPath = path.resolve(process.cwd(), '.data', 'requirements.json')
    if (fs.existsSync(seedPath)) {
      const content = fs.readFileSync(seedPath, 'utf-8')
      const parsed = JSON.parse(content) as Record<
        string,
        import('./types').ProofRequirement
      >
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
  return map[id.toLowerCase()] ?? null
}

export const getAllRequirements = (): import('./types').ProofRequirement[] => {
  const map = readReqMap()
  return Object.values(map)
}
