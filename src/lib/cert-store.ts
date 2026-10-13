import fs from 'fs'
import path from 'path'
import type { CertificateRecord } from './types'

const getStorageFilePath = (): string => {
  const dir = path.resolve(process.cwd(), '.data')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return path.join(dir, 'certs.json')
}

const readCertMap = (): Record<string, CertificateRecord> => {
  try {
    const filePath = getStorageFilePath()
    if (!fs.existsSync(filePath)) {
      return {}
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as Record<string, CertificateRecord>
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
