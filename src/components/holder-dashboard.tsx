'use client'

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  formatUnits,
  parseUnits,
  toHex,
  type LocalAccount,
} from 'viem'
import {
  KeyRound,
  ShieldCheck,
  FileDown,
  Copy,
  Check,
  Lock,
  Eye,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Wallet,
  ArrowRight,
  Activity,
  Layers,
  Link2,
  CheckCircle2,
  Plus,
  X,
} from 'lucide-react'
import { sileo } from 'sileo'
import {
  monadTestnet,
  isContractsConfigured,
  type ContractAddresses,
} from '@/lib/chain-config'
import { erc20Abi, lockVaultAbi } from '@/lib/contracts/abis'
import { createMeraAccount, loginMeraAccount } from '@/lib/mera-auth'
import { getEip712Domain, proofRequestTypes } from '@/lib/eip712'
import type {
  IssueProofResponse,
  IssueProofRequestBody,
  ProofRequirement,
} from '@/lib/types'

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

type HolderDashboardProps = {
  contractAddresses: ContractAddresses
}

type CreatedCert = {
  certId: `0x${string}`
  salt: `0x${string}`
  txHash: `0x${string}`
  pdfUrl: string
  verifyUrl: string
  revealUrl: string
  mode: 'Observed' | 'Locked'
  threshold: string
  tokenSymbol: string
}

const client = createPublicClient({
  chain: monadTestnet,
  transport: http(
    process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz',
  ),
})

function subscribeTime(callback: () => void) {
  const timer = setInterval(callback, 10000)
  return () => clearInterval(timer)
}

function getTimeSnapshot() {
  return Math.floor(Date.now() / 1000)
}

function getServerSnapshot() {
  return 0
}

export function HolderDashboard({ contractAddresses }: HolderDashboardProps) {
  const isConfigured = isContractsConfigured(contractAddresses)

  const [localAccount, setLocalAccount] = useState<LocalAccount | null>(null)
  const [injectedAddress, setInjectedAddress] = useState<`0x${string}` | null>(
    null,
  )
  const activeAddress = localAccount?.address || injectedAddress

  const [authMethod, setAuthMethod] = useState<string | null>(null)
  const [balance, setBalance] = useState<bigint>(BigInt(0))
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const selectedToken: `0x${string}` = contractAddresses.usdc
  const [tokenSymbol, setTokenSymbol] = useState<string>('USDC')
  const [tokenDecimals, setTokenDecimals] = useState<number>(6)

  const [thresholdInput, setThresholdInput] = useState<string>('10')
  const [windowPreset, setWindowPreset] = useState<number>(604800)
  const [mode, setMode] = useState<number>(0)
  const [expiryPreset, setExpiryPreset] = useState<number>(604800)
  const [privacyMode, setPrivacyMode] = useState<'notarized' | 'open'>(
    'notarized',
  )
  const [vaultLockedAmount, setVaultLockedAmount] = useState<bigint>(BigInt(0))
  const [vaultUnlockAt, setVaultUnlockAt] = useState<bigint>(BigInt(0))
  const [isCheckingVault, setIsCheckingVault] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'holder' | 'verifier'>('holder')
  const currentTime = useSyncExternalStore(
    subscribeTime,
    getTimeSnapshot,
    getServerSnapshot,
  )

  const [requirementsList, setRequirementsList] = useState<ProofRequirement[]>(
    [],
  )
  const [reqTitle, setReqTitle] = useState('')
  const [reqAmount, setReqAmount] = useState('10')
  const [reqHoldSeconds, setReqHoldSeconds] = useState(86400)
  const [reqDescription, setReqDescription] = useState('')
  const [isCreatingReq, setIsCreatingReq] = useState(false)
  const [createdReqUrl, setCreatedReqUrl] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLocking, setIsLocking] = useState(false)
  const [createdCert, setCreatedCert] = useState<CreatedCert | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [includeSalt, setIncludeSalt] = useState<boolean>(false)
  const [isDownloadingEvidence, setIsDownloadingEvidence] =
    useState<boolean>(false)

  const refreshBalance = useCallback(
    async (targetAddress?: `0x${string}`, targetToken?: `0x${string}`) => {
      const addr = targetAddress || activeAddress
      const tok = targetToken || selectedToken
      if (!addr || !tok || tok === '0x0000000000000000000000000000000000000000')
        return

      try {
        setIsRefreshingBalance(true)
        const [bal, dec, sym] = await Promise.all([
          client.readContract({
            address: tok,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [addr],
          }) as Promise<bigint>,
          client
            .readContract({
              address: tok,
              abi: erc20Abi,
              functionName: 'decimals',
            })
            .catch(() => 6) as Promise<number>,
          client
            .readContract({
              address: tok,
              abi: erc20Abi,
              functionName: 'symbol',
            })
            .catch(() => 'USDC') as Promise<string>,
        ])

        setBalance(bal)
        setTokenDecimals(dec)
        setTokenSymbol(sym)
      } catch (err: unknown) {
        console.error('Failed to read balance:', err)
      } finally {
        setIsRefreshingBalance(false)
      }
    },
    [activeAddress, selectedToken],
  )

  const checkVaultLock = useCallback(
    async (targetAddress?: `0x${string}`, targetToken?: `0x${string}`) => {
      const addr = targetAddress || activeAddress
      const tok = targetToken || selectedToken
      if (
        !addr ||
        !tok ||
        !isConfigured ||
        tok === '0x0000000000000000000000000000000000000000'
      ) {
        return
      }

      try {
        setIsCheckingVault(true)
        const result = (await client.readContract({
          address: contractAddresses.lockVault,
          abi: lockVaultAbi,
          functionName: 'lockOf',
          args: [addr, tok],
        })) as readonly [bigint, bigint]

        setVaultLockedAmount(result[0])
        setVaultUnlockAt(result[1])
      } catch (err: unknown) {
        console.error('Failed to read lockOf from LockVault:', err)
      } finally {
        setIsCheckingVault(false)
      }
    },
    [activeAddress, selectedToken, isConfigured, contractAddresses.lockVault],
  )

  useEffect(() => {
    if (
      activeAddress &&
      selectedToken &&
      selectedToken !== '0x0000000000000000000000000000000000000000'
    ) {
      queueMicrotask(() => {
        void refreshBalance(activeAddress, selectedToken)
        void checkVaultLock(activeAddress, selectedToken)
      })
    }
  }, [activeAddress, selectedToken, refreshBalance, checkVaultLock])

  const fetchRequirements = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/requirements')
      if (res.ok) {
        const data = (await res.json()) as { requirements: ProofRequirement[] }
        setRequirementsList(data.requirements || [])
      }
    } catch (err: unknown) {
      console.error('Failed to load requirements:', err)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'verifier') {
      queueMicrotask(() => {
        void fetchRequirements()
      })
    }
  }, [activeTab, fetchRequirements])

  const handleCreateRequirement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqTitle.trim() || !reqAmount.trim()) return
    try {
      setIsCreatingReq(true)
      setActionError(null)
      const res = await fetch('/api/v1/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reqTitle.trim(),
          description: reqDescription.trim() || undefined,
          token: selectedToken,
          tokenSymbol,
          minAmount: reqAmount.trim(),
          minHoldSeconds: reqHoldSeconds,
          requiredMode: 0,
          creator: activeAddress || undefined,
        }),
      })

      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create requirement')
      }

      setCreatedReqUrl(data.url || null)
      setReqTitle('')
      setReqDescription('')
      void fetchRequirements()
      sileo.success({
        title: 'Requirement link created',
        description: 'Shareable screening link is ready to use.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
      sileo.error({
        title: 'Creation failed',
        description: msg,
      })
    } finally {
      setIsCreatingReq(false)
    }
  }

  const handleConnectBrowserWallet = async () => {
    try {
      const eth =
        typeof window !== 'undefined'
          ? (window as unknown as { ethereum?: EthereumProvider }).ethereum
          : undefined

      if (!eth) {
        throw new Error(
          'No Web3 browser wallet detected (MetaMask, Rabby, etc.)',
        )
      }

      const accounts = (await eth.request({
        method: 'eth_requestAccounts',
      })) as string[]

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found in wallet')
      }

      const addr = accounts[0] as `0x${string}`
      setInjectedAddress(addr)
      setLocalAccount(null)
      setAuthMethod('Browser Wallet')
      setActionError(null)
      sileo.success({
        title: 'Wallet connected',
        description: `${addr.slice(0, 8)}...${addr.slice(-6)}`,
      })
      await refreshBalance(addr, selectedToken)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
      sileo.error({
        title: 'Connection failed',
        description: msg,
      })
    }
  }

  const handleMeraRegister = async () => {
    try {
      sileo.info({
        title: 'Biometric passkey',
        description: 'Follow prompt to create passkey with Face ID / Touch ID',
      })
      const session = await createMeraAccount('holder')
      setLocalAccount(session.account)
      setInjectedAddress(null)
      setAuthMethod('Mera Passkey (BIP-44 via WebAuthn PRF)')
      setActionError(null)
      sileo.success({
        title: 'Passkey account active',
        description: `${session.address.slice(0, 8)}...${session.address.slice(-6)}`,
      })
      await refreshBalance(session.account.address, selectedToken)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
      sileo.error({
        title: 'Passkey failed',
        description: msg,
      })
    }
  }

  const handleMeraLogin = async () => {
    try {
      sileo.info({
        title: 'Signing in',
        description: 'Touch ID or Face ID biometric sign-in...',
      })
      const session = await loginMeraAccount()
      setLocalAccount(session.account)
      setInjectedAddress(null)
      setAuthMethod('Mera Passkey (BIP-44 via WebAuthn PRF)')
      setActionError(null)
      sileo.success({
        title: 'Passkey authenticated',
        description: `${session.address.slice(0, 8)}...${session.address.slice(-6)}`,
      })
      await refreshBalance(session.account.address, selectedToken)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
      sileo.error({
        title: 'Passkey sign-in failed',
        description: msg,
      })
    }
  }

  const getActiveWalletClient = () => {
    if (localAccount) {
      return createWalletClient({
        account: localAccount,
        chain: monadTestnet,
        transport: http(
          process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet-rpc.monad.xyz',
        ),
      })
    }

    if (injectedAddress && typeof window !== 'undefined') {
      const eth = (window as unknown as { ethereum?: EthereumProvider })
        .ethereum
      if (eth) {
        return createWalletClient({
          account: injectedAddress,
          chain: monadTestnet,
          transport: custom(eth as Parameters<typeof custom>[0]),
        })
      }
    }

    throw new Error('No wallet connected')
  }

  const handleDepositVault = async () => {
    if (!activeAddress) return
    if (!isConfigured) {
      const msg = 'Protocol contracts are not configured on this environment.'
      setActionError(msg)
      sileo.error({ title: 'Configuration error', description: msg })
      return
    }
    try {
      setIsLocking(true)
      setActionError(null)
      const parsedAmount = parseUnits(thresholdInput, tokenDecimals)
      const unlockAt = BigInt(
        Math.floor(Date.now() / 1000) + expiryPreset + 86400,
      )
      const wallet = getActiveWalletClient()

      sileo.info({
        title: 'Locking collateral',
        description: 'Step 1/2: Approving token allowance...',
      })

      const approveTx = await wallet.writeContract({
        address: selectedToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [contractAddresses.lockVault, parsedAmount],
      })
      await client.waitForTransactionReceipt({ hash: approveTx })

      sileo.info({
        title: 'Locking collateral',
        description: 'Step 2/2: Confirming vault deposit...',
      })

      const depositTx = await wallet.writeContract({
        address: contractAddresses.lockVault,
        abi: lockVaultAbi,
        functionName: 'deposit',
        args: [selectedToken, parsedAmount, unlockAt],
      })
      await client.waitForTransactionReceipt({ hash: depositTx })

      await Promise.all([
        refreshBalance(activeAddress, selectedToken),
        checkVaultLock(activeAddress, selectedToken),
      ])

      sileo.success({
        title: 'Vault locked successfully',
        description: `${thresholdInput} ${tokenSymbol} locked until ${new Date(Number(unlockAt) * 1000).toLocaleDateString()}`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
      sileo.error({ title: 'Vault deposit failed', description: msg })
    } finally {
      setIsLocking(false)
    }
  }

  const handleCreateProof = async () => {
    if (!activeAddress) return
    if (!isConfigured) {
      const msg = 'Protocol contracts are not configured in .env.local.'
      setActionError(msg)
      sileo.error({ title: 'Configuration error', description: msg })
      return
    }
    try {
      setIsSubmitting(true)
      setActionError(null)

      const now = Math.floor(Date.now() / 1000)
      const thresholdBase = parseUnits(thresholdInput, tokenDecimals)
      let expiresAt = now + expiryPreset
      if (mode === 1) {
        if (vaultUnlockAt <= BigInt(now)) {
          const msg =
            'Vault lock has expired. Deposit new funds into LockVault to re-lock.'
          setActionError(msg)
          sileo.error({ title: 'Vault expired', description: msg })
          return
        }
        expiresAt = Math.min(expiresAt, Number(vaultUnlockAt))
      }
      const deadline = now + 3600
      const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)))

      const domain = getEip712Domain(10143, contractAddresses.averRegistry)
      const wallet = getActiveWalletClient()

      sileo.info({
        title: 'Authorizing proof',
        description: 'Sign EIP-712 typed data in your wallet...',
      })

      const signature = await wallet.signTypedData({
        domain,
        types: proofRequestTypes,
        primaryType: 'ProofRequest',
        message: {
          holder: activeAddress,
          token: selectedToken,
          threshold: thresholdBase,
          windowSeconds: BigInt(windowPreset),
          mode,
          expiresAt: BigInt(expiresAt),
          nonce,
          deadline: BigInt(deadline),
        },
      })

      sileo.info({
        title: 'Anchoring proof',
        description:
          'Attestor verifying evidence and executing onchain anchor...',
      })

      const requestBody: IssueProofRequestBody = {
        proofRequest: {
          holder: activeAddress,
          token: selectedToken,
          threshold: thresholdBase.toString(),
          windowSeconds: windowPreset,
          mode,
          expiresAt,
          nonce,
          deadline,
        },
        signature,
      }

      const res = await fetch('/api/v1/proofs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = (await res.json()) as IssueProofResponse & { error?: string }

      if (!res.ok) {
        throw new Error(data.error || 'Attestor failed to issue certificate')
      }

      const revealPayload = {
        address: activeAddress,
        salt: data.salt,
      }
      const revealBase64 = btoa(JSON.stringify(revealPayload))
      const revealUrl = `${data.verifyUrl}#reveal=${revealBase64}`

      setCreatedCert({
        certId: data.certId,
        salt: data.salt,
        txHash: data.txHash,
        pdfUrl: data.pdfUrl,
        verifyUrl: data.verifyUrl,
        revealUrl,
        mode: mode === 1 ? 'Locked' : 'Observed',
        threshold: thresholdInput,
        tokenSymbol,
      })

      sileo.success({
        title: 'Certificate anchored on Monad',
        description: `Certificate #${data.certId.slice(0, 10)}... is active.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
      sileo.error({ title: 'Issuance failed', description: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownloadEvidence = async () => {
    if (!createdCert) return
    try {
      setIsDownloadingEvidence(true)
      const queryParam = includeSalt ? '?full=true' : ''

      const res = await fetch(
        `/api/v1/certs/${createdCert.certId}/evidence${queryParam}`,
        {
          headers: {
            Authorization: `Bearer ${createdCert.salt}`,
          },
        },
      )

      if (!res.ok) {
        throw new Error(`Failed to fetch evidence bundle (${res.status})`)
      }

      const bundle = await res.json()
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      })
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `aver-evidence-${createdCert.certId.slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
      sileo.success({
        title: 'Evidence downloaded',
        description: 'JSON evidence bundle saved to disk.',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setActionError(msg)
      sileo.error({
        title: 'Download failed',
        description: msg,
      })
    } finally {
      setIsDownloadingEvidence(false)
    }
  }

  const copyToClipboard = (text: string, key: string, label?: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
    sileo.success({
      title: 'Copied to clipboard',
      description: label || 'Value copied successfully.',
    })
  }

  const parsedThreshold = (() => {
    try {
      return parseUnits(thresholdInput || '0', tokenDecimals)
    } catch {
      return BigInt(0)
    }
  })()

  const isVaultPrereqMet =
    mode === 1 &&
    parsedThreshold > BigInt(0) &&
    vaultLockedAmount >= parsedThreshold &&
    (currentTime === 0 || vaultUnlockAt > BigInt(currentTime))

  return (
    <div className='space-y-6 max-w-4xl mx-auto'>
      {!isConfigured && (
        <div className='p-4 sm:p-5 rounded-2xl border border-amber-200/90 bg-amber-50/70 text-amber-950 flex items-start gap-3.5 shadow-xs'>
          <AlertTriangle className='w-5 h-5 text-amber-600 shrink-0 mt-0.5' />
          <div className='text-xs space-y-1'>
            <div className='font-semibold text-sm text-amber-950'>
              Protocol Contracts Unconfigured
            </div>
            <p className='text-slate-600 leading-relaxed'>
              Target contracts are unconfigured. Deploy{' '}
              <code className='font-mono text-amber-900 font-semibold bg-amber-100/80 px-1 py-0.5 rounded'>
                LockVault
              </code>{' '}
              and{' '}
              <code className='font-mono text-amber-900 font-semibold bg-amber-100/80 px-1 py-0.5 rounded'>
                AverRegistry
              </code>{' '}
              via{' '}
              <code className='font-mono text-amber-900 font-semibold bg-amber-100/80 px-1 py-0.5 rounded'>
                bun run deploy
              </code>{' '}
              then set them in your{' '}
              <code className='font-mono text-amber-900 font-semibold bg-amber-100/80 px-1 py-0.5 rounded'>
                .env.local
              </code>
              .
            </p>
          </div>
        </div>
      )}

      <div className='flex items-center justify-between border-b border-slate-200/80 pb-4'>
        <div className='flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60'>
          <button
            type='button'
            onClick={() => setActiveTab('holder')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2 ${
              activeTab === 'holder'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className='w-4 h-4 text-emerald-600' />
            Proof Generation
          </button>
          <button
            type='button'
            onClick={() => setActiveTab('verifier')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-2 ${
              activeTab === 'verifier'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 className='w-4 h-4 text-indigo-600' />
            Screening Requirements
          </button>
        </div>

        <div className='hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500'>
          <span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
          <span>Monad Testnet</span>
        </div>
      </div>

      {activeTab === 'verifier' ? (
        <div className='space-y-6'>
          <div className='border border-slate-200/80 bg-white rounded-2xl p-6 sm:p-8 shadow-xs'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100'>
              <div>
                <div className='text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold'>
                  Screening Portal
                </div>
                <h2 className='text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5 mt-1'>
                  <Link2 className='w-5 h-5 text-indigo-600' />
                  Create Screening Requirement
                </h2>
                <p className='text-xs text-slate-500 mt-1 max-w-lg'>
                  Generate a shareable verification link for counterparties.
                  They can fulfill and prove solvency with 1 click.
                </p>
              </div>

              <div className='inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-slate-600 text-xs font-mono self-start sm:self-auto'>
                <span className='w-1.5 h-1.5 rounded-full bg-emerald-500' />
                Canonical USDC
              </div>
            </div>

            <form onSubmit={handleCreateRequirement} className='pt-6 space-y-6'>
              <div>
                <label className='block text-xs font-medium text-slate-700 mb-2'>
                  Requirement Title / Purpose
                </label>
                <input
                  type='text'
                  value={reqTitle}
                  onChange={e => setReqTitle(e.target.value)}
                  placeholder='e.g., Residential Lease — 142 Elm St, Unit 4B'
                  required
                  className='w-full bg-slate-50/70 border border-slate-200 px-4 py-2.5 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition'
                />
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                <div>
                  <label className='block text-xs font-medium text-slate-700 mb-2'>
                    Required Minimum Balance ({tokenSymbol})
                  </label>
                  <div className='relative'>
                    <input
                      type='number'
                      value={reqAmount}
                      onChange={e => setReqAmount(e.target.value)}
                      placeholder='10'
                      required
                      className='w-full bg-slate-50/70 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition'
                    />
                    <span className='absolute right-3.5 top-2.5 text-xs font-mono text-slate-400 font-semibold'>
                      {tokenSymbol}
                    </span>
                  </div>
                </div>

                <div>
                  <label className='block text-xs font-medium text-slate-700 mb-2'>
                    Historical Observation Window
                  </label>
                  <div className='grid grid-cols-3 gap-2'>
                    {[
                      { label: '1 Hour', secs: 3600 },
                      { label: '24 Hours', secs: 86400 },
                      { label: '7 Days', secs: 604800 },
                    ].map(p => (
                      <button
                        key={p.secs}
                        type='button'
                        onClick={() => setReqHoldSeconds(p.secs)}
                        className={`text-xs py-2 px-2 rounded-xl border text-center transition font-medium ${
                          reqHoldSeconds === p.secs
                            ? 'border-slate-900 bg-slate-900 text-white font-semibold shadow-xs'
                            : 'border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className='block text-xs font-medium text-slate-700 mb-2'>
                  Screening Instructions (Optional)
                </label>
                <input
                  type='text'
                  value={reqDescription}
                  onChange={e => setReqDescription(e.target.value)}
                  placeholder='e.g., Proof of funds required prior to lease signing or escrow deposit.'
                  className='w-full bg-slate-50/70 border border-slate-200 px-4 py-2.5 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition'
                />
              </div>

              <div>
                <button
                  type='submit'
                  disabled={
                    isCreatingReq || !reqTitle.trim() || !reqAmount.trim()
                  }
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-2 shadow-xs ${
                    isCreatingReq || !reqTitle.trim() || !reqAmount.trim()
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/60'
                      : 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                  }`}
                >
                  {isCreatingReq ? (
                    <>
                      <RefreshCw className='w-3.5 h-3.5 animate-spin' />
                      Generating Link...
                    </>
                  ) : (
                    <>
                      <Plus className='w-3.5 h-3.5' />
                      Create Screening Link
                    </>
                  )}
                </button>
              </div>
            </form>

            {createdReqUrl && (
              <div className='mt-6 p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'>
                <div>
                  <div className='font-semibold text-xs text-emerald-900 flex items-center gap-1.5'>
                    <CheckCircle2 className='w-4 h-4 text-emerald-600' />
                    Screening Link Ready
                  </div>
                  <div className='text-xs font-mono text-emerald-800 mt-1 break-all'>
                    {createdReqUrl}
                  </div>
                </div>
                <div className='flex items-center gap-2 shrink-0'>
                  <button
                    type='button'
                    onClick={() =>
                      copyToClipboard(
                        createdReqUrl,
                        'req_url',
                        'Screening link copied',
                      )
                    }
                    className='bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-800 transition flex items-center gap-1.5 shadow-xs'
                  >
                    {copiedKey === 'req_url' ? (
                      <>
                        <Check className='w-3.5 h-3.5' />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className='w-3.5 h-3.5' />
                        Copy Link
                      </>
                    )}
                  </button>
                  <a
                    href={createdReqUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='border border-emerald-300 bg-white text-emerald-900 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition flex items-center gap-1 shadow-xs'
                  >
                    Open
                    <ExternalLink className='w-3 h-3' />
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className='border border-slate-200/80 bg-white rounded-2xl p-6 sm:p-8 shadow-xs'>
            <h3 className='text-sm font-bold text-slate-900 mb-4 flex items-center gap-2'>
              <Layers className='w-4 h-4 text-slate-500' />
              Active Screening Requirements ({requirementsList.length})
            </h3>
            {requirementsList.length === 0 ? (
              <div className='text-xs text-slate-500 py-6 text-center font-mono'>
                No screening requirements created yet.
              </div>
            ) : (
              <div className='space-y-2.5'>
                {requirementsList.map(req => {
                  const reqUrl =
                    typeof window !== 'undefined'
                      ? `${window.location.origin}/r/${req.id}`
                      : `/r/${req.id}`
                  return (
                    <div
                      key={req.id}
                      className='p-4 rounded-xl border border-slate-200/70 bg-slate-50/40 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3'
                    >
                      <div>
                        <div className='font-semibold text-xs text-slate-900'>
                          {req.title}
                        </div>
                        <div className='text-[11px] text-slate-500 font-mono mt-0.5'>
                          ≥ ${Number(req.minAmount).toLocaleString()}{' '}
                          {req.tokenSymbol} · Observation:{' '}
                          {req.minHoldSeconds >= 86400
                            ? `${Math.round(req.minHoldSeconds / 86400)} Days`
                            : `${Math.round(req.minHoldSeconds / 3600)} Hours`}
                        </div>
                      </div>
                      <div className='flex items-center gap-2 shrink-0'>
                        <button
                          type='button'
                          onClick={() =>
                            copyToClipboard(
                              reqUrl,
                              req.id,
                              'Screening URL copied',
                            )
                          }
                          className='border border-slate-200 bg-white text-slate-700 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition shadow-xs'
                        >
                          {copiedKey === req.id ? (
                            <>
                              <Check className='w-3 h-3 text-emerald-600' />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className='w-3 h-3 text-slate-400' />
                              Copy
                            </>
                          )}
                        </button>
                        <a
                          href={`/r/${req.id}`}
                          className='bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-1 font-medium transition shadow-xs'
                        >
                          View Link
                          <ExternalLink className='w-3 h-3' />
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className='border border-slate-200/80 bg-white rounded-2xl p-6 sm:p-7 shadow-xs'>
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100'>
              <div>
                <div className='text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold'>
                  Step 1 · Identity &amp; Auth
                </div>
                <h2 className='text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2 mt-0.5'>
                  <KeyRound className='w-4.5 h-4.5 text-slate-700' />
                  Account Authentication
                </h2>
                <p className='text-xs text-slate-500 mt-0.5'>
                  {authMethod
                    ? authMethod
                    : 'Connect your Web3 browser wallet or create a passkey'}
                </p>
              </div>

              {!activeAddress ? (
                <div className='flex flex-wrap items-center gap-2'>
                  <button
                    type='button'
                    onClick={handleConnectBrowserWallet}
                    className='bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition flex items-center gap-2 shadow-xs cursor-pointer'
                  >
                    <Wallet className='w-3.5 h-3.5' />
                    Connect Wallet
                  </button>
                  <button
                    type='button'
                    onClick={handleMeraRegister}
                    className='border border-slate-200 bg-white text-slate-700 text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-50 transition flex items-center gap-2 shadow-xs cursor-pointer'
                  >
                    <Sparkles className='w-3.5 h-3.5 text-indigo-600' />
                    Biometric Passkey
                  </button>
                  <button
                    type='button'
                    onClick={handleMeraLogin}
                    className='border border-slate-200 bg-white text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-slate-50 transition shadow-xs cursor-pointer'
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <div className='flex items-center gap-2'>
                  <span className='font-mono text-xs bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl text-slate-800 font-medium'>
                    {activeAddress.slice(0, 8)}...{activeAddress.slice(-6)}
                  </span>
                  <button
                    type='button'
                    onClick={() =>
                      copyToClipboard(activeAddress, 'addr', 'Address copied')
                    }
                    className='border border-slate-200 p-2 rounded-xl hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition shadow-xs'
                    title='Copy Address'
                  >
                    {copiedKey === 'addr' ? (
                      <Check className='w-3.5 h-3.5 text-emerald-600' />
                    ) : (
                      <Copy className='w-3.5 h-3.5' />
                    )}
                  </button>
                </div>
              )}
            </div>

            {activeAddress && (
              <div className='pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                <div>
                  <div className='text-[10px] text-slate-400 font-mono uppercase tracking-wider font-semibold'>
                    Monad Testnet USDC Balance
                  </div>
                  <div className='text-3xl font-extrabold mt-1 text-slate-900 flex items-baseline gap-2 font-mono tracking-tight'>
                    <span>
                      {Number(
                        formatUnits(balance, tokenDecimals),
                      ).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className='text-sm font-sans font-medium text-slate-500'>
                      {tokenSymbol}
                    </span>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <button
                    type='button'
                    onClick={() => refreshBalance(activeAddress, selectedToken)}
                    disabled={isRefreshingBalance}
                    className='border border-slate-200/80 bg-white text-xs px-3.5 py-1.5 rounded-xl text-slate-700 hover:bg-slate-50 transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-60'
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isRefreshingBalance ? 'animate-spin' : ''}`}
                    />
                    Refresh
                  </button>
                  <a
                    href='https://faucet.monad.xyz'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-xs text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 font-medium'
                  >
                    Faucet
                    <ExternalLink className='w-3 h-3' />
                  </a>
                </div>
              </div>
            )}
          </div>

          {activeAddress && (
            <div className='border border-slate-200/80 bg-white rounded-2xl p-6 sm:p-8 text-slate-900 shadow-xs'>
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100'>
                <div>
                  <div className='text-[10px] font-mono uppercase tracking-widest text-slate-400 font-semibold'>
                    Step 2 · Configuration
                  </div>
                  <h2 className='text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5 mt-1'>
                    <ShieldCheck className='w-5 h-5 text-emerald-600' />
                    Proof Parameters
                  </h2>
                  <p className='text-xs text-slate-500 mt-0.5'>
                    Configure cryptographic conditions for your certificate.
                  </p>
                </div>

                <div className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-slate-600 text-xs font-mono self-start sm:self-auto'>
                  <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
                  Monad Chain ID 10143
                </div>
              </div>

              <div className='pt-6 space-y-7'>
                <div>
                  <div className='flex items-center justify-between mb-2'>
                    <label className='text-xs font-medium text-slate-700'>
                      Certified Threshold Amount
                    </label>
                    <span className='text-[11px] font-mono text-slate-400'>
                      Available:{' '}
                      {(Number(balance) / 10 ** tokenDecimals).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        },
                      )}{' '}
                      {tokenSymbol}
                    </span>
                  </div>

                  <div className='flex flex-col sm:flex-row gap-3 items-stretch sm:items-center'>
                    <div className='relative flex-1'>
                      <input
                        type='number'
                        value={thresholdInput}
                        onChange={e => setThresholdInput(e.target.value)}
                        className='w-full bg-slate-50/70 border border-slate-200 px-4 py-2.5 rounded-xl text-xl font-bold font-mono text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white transition'
                        placeholder='10'
                      />
                      <span className='absolute right-3.5 top-3 text-xs font-mono font-bold text-slate-400'>
                        {tokenSymbol}
                      </span>
                    </div>

                    <div className='flex gap-1.5 shrink-0'>
                      {['10', '50', '100', '500'].map(amt => (
                        <button
                          key={amt}
                          type='button'
                          onClick={() => setThresholdInput(amt)}
                          className={`text-xs px-3 py-2 rounded-xl border font-mono transition ${
                            thresholdInput === amt
                              ? 'border-slate-900 bg-slate-900 text-white font-semibold shadow-xs'
                              : 'border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          ${Number(amt).toLocaleString()}
                        </button>
                      ))}
                      {balance > 0n && (
                        <button
                          type='button'
                          onClick={() =>
                            setThresholdInput(
                              Math.floor(
                                Number(balance) / 10 ** tokenDecimals,
                              ).toString(),
                            )
                          }
                          className='text-xs px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono font-bold transition shadow-xs'
                        >
                          Max
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                  <div>
                    <label className='block text-xs font-medium text-slate-700 mb-1'>
                      Historical Observation Window
                    </label>
                    <p className='text-[11px] text-slate-500 mb-2'>
                      Verifies balance maintained continuously over this window.
                    </p>
                    <div className='grid grid-cols-3 gap-2'>
                      {[
                        { label: '1 Hour', secs: 3600 },
                        { label: '24 Hours', secs: 86400 },
                        { label: '7 Days', secs: 604800 },
                      ].map(p => (
                        <button
                          key={p.secs}
                          type='button'
                          onClick={() => setWindowPreset(p.secs)}
                          className={`text-xs py-2 px-2 rounded-xl border text-center transition font-medium ${
                            windowPreset === p.secs
                              ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                              : 'border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className='block text-xs font-medium text-slate-700 mb-1'>
                      Certificate Validity Expiry
                    </label>
                    <p className='text-[11px] text-slate-500 mb-2'>
                      Duration until this certificate naturally expires.
                    </p>
                    <div className='grid grid-cols-3 gap-2'>
                      {[
                        { label: '24 Hours', secs: 86400 },
                        { label: '7 Days', secs: 604800 },
                        { label: '30 Days', secs: 2592000 },
                      ].map(p => (
                        <button
                          key={p.secs}
                          type='button'
                          onClick={() => setExpiryPreset(p.secs)}
                          className={`text-xs py-2 px-2 rounded-xl border text-center transition font-medium ${
                            expiryPreset === p.secs
                              ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                              : 'border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1'>
                  <div>
                    <label className='block text-xs font-medium text-slate-700 mb-2'>
                      Guarantee Mechanism
                    </label>
                    <div className='grid grid-cols-2 gap-2.5'>
                      <button
                        type='button'
                        onClick={() => setMode(0)}
                        className={`p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                          mode === 0
                            ? 'border-slate-900 bg-slate-50/80 ring-1 ring-slate-900 shadow-xs'
                            : 'border-slate-200/80 bg-white hover:bg-slate-50/60'
                        }`}
                      >
                        <div className='font-semibold text-xs flex items-center gap-1.5 text-slate-900'>
                          <Activity className='w-3.5 h-3.5 text-slate-700' />
                          Self-Custody
                        </div>
                        <div className='text-[11px] text-slate-500 mt-1 leading-relaxed'>
                          Funds remain in your wallet. Monitored for balance
                          breaches.
                        </div>
                      </button>

                      <button
                        type='button'
                        onClick={() => setMode(1)}
                        className={`p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                          mode === 1
                            ? 'border-emerald-700 bg-emerald-50/50 ring-1 ring-emerald-700 shadow-xs'
                            : 'border-slate-200/80 bg-white hover:bg-slate-50/60'
                        }`}
                      >
                        <div className='font-semibold text-xs flex items-center gap-1.5 text-slate-900'>
                          <Lock className='w-3.5 h-3.5 text-emerald-700' />
                          Vault Escrow
                        </div>
                        <div className='text-[11px] text-slate-500 mt-1 leading-relaxed'>
                          Funds locked in smart contract. Guaranteed against
                          withdrawal.
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className='block text-xs font-medium text-slate-700 mb-2'>
                      Privacy Level
                    </label>
                    <div className='grid grid-cols-2 gap-2.5'>
                      <button
                        type='button'
                        onClick={() => setPrivacyMode('notarized')}
                        className={`p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                          privacyMode === 'notarized'
                            ? 'border-slate-900 bg-slate-50/80 ring-1 ring-slate-900 shadow-xs'
                            : 'border-slate-200/80 bg-white hover:bg-slate-50/60'
                        }`}
                      >
                        <div className='font-semibold text-xs flex items-center gap-1.5 text-slate-900'>
                          <Eye className='w-3.5 h-3.5 text-slate-700' />
                          Private Proof
                        </div>
                        <div className='text-[11px] text-slate-500 mt-1 leading-relaxed'>
                          Blinded with salt. Solvency proved without revealing
                          address.
                        </div>
                      </button>

                      <button
                        type='button'
                        onClick={() => setPrivacyMode('open')}
                        className={`p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                          privacyMode === 'open'
                            ? 'border-emerald-700 bg-emerald-50/50 ring-1 ring-emerald-700 shadow-xs'
                            : 'border-slate-200/80 bg-white hover:bg-slate-50/60'
                        }`}
                      >
                        <div className='font-semibold text-xs flex items-center gap-1.5 text-slate-900'>
                          <Layers className='w-3.5 h-3.5 text-emerald-700' />
                          Direct Reveal
                        </div>
                        <div className='text-[11px] text-slate-500 mt-1 leading-relaxed'>
                          Includes public address for verifiers doing RPC
                          lookups.
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {mode === 1 && (
                  <div
                    className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 ${
                      isVaultPrereqMet
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                        : 'border-slate-200/80 bg-slate-50/60 text-slate-900'
                    }`}
                  >
                    <div>
                      <div className='font-semibold flex items-center gap-1.5'>
                        {isVaultPrereqMet ? (
                          <>
                            <CheckCircle2 className='w-4 h-4 text-emerald-600' />
                            Vault Collateral Locked
                          </>
                        ) : (
                          <>
                            <Lock className='w-4 h-4 text-slate-600' />
                            Vault Action Required
                          </>
                        )}
                      </div>
                      <div className='text-slate-600 mt-0.5 text-[11px] leading-relaxed'>
                        {isVaultPrereqMet ? (
                          <>
                            <span className='font-mono font-bold text-slate-900'>
                              {formatUnits(vaultLockedAmount, tokenDecimals)}{' '}
                              {tokenSymbol}
                            </span>{' '}
                            deposited in LockVault (unlocks{' '}
                            {vaultUnlockAt > BigInt(0) &&
                              new Date(
                                Number(vaultUnlockAt) * 1000,
                              ).toLocaleDateString()}
                            ). Requirement satisfied.
                          </>
                        ) : (
                          <>
                            Lock {thresholdInput} {tokenSymbol} into LockVault
                            before anchoring.
                            {vaultLockedAmount > BigInt(0) && (
                              <span className='block text-slate-500 font-mono mt-0.5'>
                                Currently locked:{' '}
                                {formatUnits(vaultLockedAmount, tokenDecimals)}{' '}
                                {tokenSymbol}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type='button'
                      onClick={handleDepositVault}
                      disabled={
                        isLocking || isVaultPrereqMet || isCheckingVault
                      }
                      className={`text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto shadow-xs ${
                        isVaultPrereqMet
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-not-allowed opacity-90'
                          : isLocking
                            ? 'bg-slate-200 text-slate-600 cursor-wait'
                            : 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                      }`}
                    >
                      {isVaultPrereqMet ? (
                        <>
                          <Check className='w-3.5 h-3.5 text-emerald-700' />
                          Locked in Vault
                        </>
                      ) : isLocking ? (
                        <>
                          <RefreshCw className='w-3.5 h-3.5 animate-spin' />
                          Locking...
                        </>
                      ) : (
                        <>
                          <Lock className='w-3.5 h-3.5' />
                          Lock {thresholdInput} {tokenSymbol}
                        </>
                      )}
                    </button>
                  </div>
                )}

                {actionError && (
                  <div className='p-3.5 rounded-xl border border-rose-200 bg-rose-50/90 text-rose-950 text-xs flex items-start justify-between gap-2.5 shadow-xs'>
                    <div className='flex items-start gap-2'>
                      <AlertCircle className='w-4 h-4 text-rose-600 shrink-0 mt-0.5' />
                      <div className='font-mono leading-relaxed break-all'>
                        {actionError}
                        {actionError.includes(
                          'Holder balance did not satisfy threshold',
                        ) && (
                          <div className='mt-1.5 font-sans text-rose-800 text-[11px] font-normal'>
                            Tip: Your account was funded recently and has not
                            held this balance across the full historical
                            observation window. Select{' '}
                            <strong>Vault Escrow</strong> above to lock funds
                            and certify immediately, or choose a shorter
                            observation window.
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type='button'
                      onClick={() => setActionError(null)}
                      className='p-1 text-rose-400 hover:text-rose-700 cursor-pointer'
                      title='Dismiss error'
                    >
                      <X className='w-3.5 h-3.5' />
                    </button>
                  </div>
                )}

                <div className='pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'>
                  <div className='text-xs font-mono text-slate-500 flex items-center gap-2'>
                    <span className='w-2 h-2 rounded-full bg-emerald-500' />
                    EIP-712 Typed Signature · Monad Testnet
                  </div>

                  <button
                    type='button'
                    onClick={handleCreateProof}
                    disabled={isSubmitting || (mode === 1 && !isVaultPrereqMet)}
                    className='bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs tracking-wide px-6 py-2.5 rounded-xl transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs shrink-0 cursor-pointer'
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className='w-3.5 h-3.5 animate-spin' />
                        Anchoring Onchain Proof...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className='w-4 h-4' />
                        {mode === 1 && !isVaultPrereqMet
                          ? 'Vault Deposit Required'
                          : 'Anchor & Seal Certificate'}
                        <ArrowRight className='w-3.5 h-3.5' />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {createdCert && (
            <div className='border border-slate-200/80 bg-white rounded-2xl p-6 sm:p-8 text-slate-900 shadow-xs'>
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100'>
                <div>
                  <div className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono uppercase tracking-wider font-semibold'>
                    <span className='w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse' />
                    Onchain Anchored
                  </div>
                  <h3 className='text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1.5'>
                    Certificate #{createdCert.certId.slice(0, 10)}...
                  </h3>
                </div>

                <a
                  href={createdCert.pdfUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition flex items-center gap-2 self-start sm:self-auto shadow-xs'
                >
                  <FileDown className='w-4 h-4' />
                  Download PDF Certificate
                </a>
              </div>

              <div className='pt-6 space-y-4 text-xs font-mono'>
                <div>
                  <div className='text-slate-600 mb-1 font-semibold text-[11px]'>
                    Public Verification Link (Share with Verifier):
                  </div>
                  <div className='flex items-center gap-2 bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl'>
                    <span className='truncate flex-1 text-slate-900'>
                      {createdCert.verifyUrl}
                    </span>
                    <button
                      type='button'
                      onClick={() =>
                        copyToClipboard(
                          createdCert.verifyUrl,
                          'vurl',
                          'Verification URL copied',
                        )
                      }
                      className='p-1.5 hover:text-slate-900 text-slate-500 transition'
                    >
                      {copiedKey === 'vurl' ? (
                        <Check className='w-4 h-4 text-emerald-600' />
                      ) : (
                        <Copy className='w-4 h-4' />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <div className='text-slate-600 mb-1 font-semibold text-[11px]'>
                    Direct Reveal URL (Direct RPC Verification):
                  </div>
                  <div className='flex items-center gap-2 bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl'>
                    <span className='truncate flex-1 text-slate-900'>
                      {createdCert.revealUrl}
                    </span>
                    <button
                      type='button'
                      onClick={() =>
                        copyToClipboard(
                          createdCert.revealUrl,
                          'rurl',
                          'Reveal URL copied',
                        )
                      }
                      className='p-1.5 hover:text-slate-900 text-slate-500 transition'
                    >
                      {copiedKey === 'rurl' ? (
                        <Check className='w-4 h-4 text-emerald-600' />
                      ) : (
                        <Copy className='w-4 h-4' />
                      )}
                    </button>
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1'>
                  <div className='bg-slate-50 border border-slate-200/70 p-3 rounded-xl'>
                    <span className='text-slate-400'>Certificate ID: </span>
                    <span className='font-bold break-all text-slate-900'>
                      {createdCert.certId}
                    </span>
                  </div>
                  <div className='bg-slate-50 border border-slate-200/70 p-3 rounded-xl'>
                    <span className='text-slate-400'>Anchor Transaction: </span>
                    <a
                      href={`https://testnet.monadscan.com/tx/${createdCert.txHash}`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='font-bold text-indigo-600 hover:underline inline-flex items-center gap-1'
                    >
                      {createdCert.txHash.slice(0, 14)}...
                      <ExternalLink className='w-3 h-3' />
                    </a>
                  </div>
                </div>

                <div className='p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 font-sans'>
                  <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                    <div>
                      <div className='font-semibold text-xs text-slate-900 flex items-center gap-1.5'>
                        <ShieldCheck className='w-4 h-4 text-indigo-600' />
                        Cryptographic Evidence Bundle
                      </div>
                      <div className='text-[11px] text-slate-500 mt-0.5'>
                        Includes Merkle hashes, transfer logs, and mathematical
                        audit traces.
                      </div>
                    </div>

                    <button
                      type='button'
                      onClick={handleDownloadEvidence}
                      disabled={isDownloadingEvidence}
                      className='bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto disabled:opacity-50 shadow-xs cursor-pointer'
                    >
                      <FileDown className='w-3.5 h-3.5' />
                      {isDownloadingEvidence
                        ? 'Downloading...'
                        : 'Download Evidence'}
                    </button>
                  </div>

                  <div className='pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2'>
                    <label className='flex items-center gap-2 cursor-pointer select-none'>
                      <input
                        type='checkbox'
                        checked={includeSalt}
                        onChange={e => setIncludeSalt(e.target.checked)}
                        className='rounded border-slate-300 text-indigo-600 focus:ring-indigo-500'
                      />
                      <span className='text-xs font-medium text-slate-700'>
                        Include salt (discloses address ownership in bundle)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
