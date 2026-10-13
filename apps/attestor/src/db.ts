import { Database } from 'bun:sqlite'
import fs from 'fs'
import path from 'path'

export type DbCertRecord = {
  certId: `0x${string}`
  holder: `0x${string}`
  salt: `0x${string}`
  evidenceHash: `0x${string}`
  evidenceBundle: string
  token: `0x${string}`
  threshold: string
  windowSeconds: number
  issuedAt: number
  expiresAt: number
  mode: number
  txHash: `0x${string}`
  createdAt: number
}

type CertRow = {
  cert_id: string
  holder: string
  salt: string
  evidence_hash?: string
  evidence_bundle?: string
  token: string
  threshold: string
  window_seconds: number
  issued_at: number
  expires_at: number
  mode: number
  tx_hash: string
  created_at: number
}

export class AttestorDatabase {
  private db: Database

  constructor(dbPath: string = '.data/attestor.sqlite') {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    this.db = new Database(dbPath)
    this.init()
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS certs (
        cert_id TEXT PRIMARY KEY,
        holder TEXT NOT NULL,
        salt TEXT NOT NULL,
        evidence_hash TEXT NOT NULL DEFAULT '',
        evidence_bundle TEXT NOT NULL DEFAULT '',
        token TEXT NOT NULL,
        threshold TEXT NOT NULL,
        window_seconds INTEGER NOT NULL,
        issued_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        mode INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nonces (
        holder TEXT NOT NULL,
        nonce TEXT NOT NULL,
        used_at INTEGER NOT NULL,
        PRIMARY KEY (holder, nonce)
      );

      CREATE INDEX IF NOT EXISTS idx_certs_holder ON certs(holder);
      CREATE INDEX IF NOT EXISTS idx_certs_mode ON certs(mode);
    `)

    try {
      this.db.exec(
        `ALTER TABLE certs ADD COLUMN evidence_hash TEXT NOT NULL DEFAULT ''`,
      )
    } catch {}

    try {
      this.db.exec(
        `ALTER TABLE certs ADD COLUMN evidence_bundle TEXT NOT NULL DEFAULT ''`,
      )
    } catch {}
  }

  public saveCert(record: DbCertRecord): void {
    const query = this.db.query(`
      INSERT OR REPLACE INTO certs (
        cert_id, holder, salt, evidence_hash, evidence_bundle, token, threshold, window_seconds,
        issued_at, expires_at, mode, tx_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    query.run(
      record.certId.toLowerCase(),
      record.holder.toLowerCase(),
      record.salt,
      record.evidenceHash,
      record.evidenceBundle,
      record.token.toLowerCase(),
      record.threshold,
      record.windowSeconds,
      record.issuedAt,
      record.expiresAt,
      record.mode,
      record.txHash,
      record.createdAt,
    )
  }

  public getCertById(certId: string): DbCertRecord | null {
    const query = this.db.query<CertRow, [string]>(`
      SELECT * FROM certs WHERE cert_id = ?
    `)
    const row = query.get(certId.toLowerCase())
    if (!row) return null

    return {
      certId: row.cert_id as `0x${string}`,
      holder: row.holder as `0x${string}`,
      salt: row.salt as `0x${string}`,
      evidenceHash: (row.evidence_hash ||
        '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`,
      evidenceBundle: row.evidence_bundle || '',
      token: row.token as `0x${string}`,
      threshold: row.threshold,
      windowSeconds: row.window_seconds,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
      mode: row.mode,
      txHash: row.tx_hash as `0x${string}`,
      createdAt: row.created_at,
    }
  }

  public getActiveObservedCerts(): DbCertRecord[] {
    const query = this.db.query<CertRow, []>(`
      SELECT * FROM certs WHERE mode = 0
    `)
    const rows = query.all()

    return rows.map((row: CertRow) => ({
      certId: row.cert_id as `0x${string}`,
      holder: row.holder as `0x${string}`,
      salt: row.salt as `0x${string}`,
      evidenceHash: (row.evidence_hash ||
        '0x0000000000000000000000000000000000000000000000000000000000000000') as `0x${string}`,
      evidenceBundle: row.evidence_bundle || '',
      token: row.token as `0x${string}`,
      threshold: row.threshold,
      windowSeconds: row.window_seconds,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
      mode: row.mode,
      txHash: row.tx_hash as `0x${string}`,
      createdAt: row.created_at,
    }))
  }

  public useNonce(holder: string, nonce: string): boolean {
    try {
      const query = this.db.query(`
        INSERT INTO nonces (holder, nonce, used_at) VALUES (?, ?, ?)
      `)
      query.run(
        holder.toLowerCase(),
        nonce.toLowerCase(),
        Math.floor(Date.now() / 1000),
      )
      return true
    } catch {
      return false
    }
  }

  public isNonceUsed(holder: string, nonce: string): boolean {
    const query = this.db.query(`
      SELECT 1 FROM nonces WHERE holder = ? AND nonce = ?
    `)
    const row = query.get(holder.toLowerCase(), nonce.toLowerCase())
    return Boolean(row)
  }

  public close(): void {
    this.db.close()
  }
}
