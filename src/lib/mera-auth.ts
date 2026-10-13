import { HDKey } from '@scure/bip32'
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import {
  createPasskeyWithPrfOutput,
  getPasskeyPrfOutput,
  createSecp256k1SigningSession,
} from '@category-labs/mera'
import { toViemAccount } from '@category-labs/mera/viem'
import type { LocalAccount } from 'viem'

export type MeraAccountSession = {
  address: `0x${string}`
  account: LocalAccount
  authType: 'mera-passkey' | 'ephemeral-key'
}

export const deriveEvmKey = (
  prfOutput: Uint8Array,
  index: number = 0,
): Uint8Array => {
  const mnemonic = entropyToMnemonic(prfOutput, wordlist)
  const seed = mnemonicToSeedSync(mnemonic)
  try {
    const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`)
    if (!node.privateKey) {
      throw new Error('Derivation produced no private key')
    }
    return node.privateKey
  } finally {
    seed.fill(0)
  }
}

const getRelyingPartyId = (): string => {
  if (typeof window === 'undefined') return 'localhost'
  return window.location.hostname
}

export const isWebAuthnPrfSupported = (): boolean => {
  if (typeof window === 'undefined') return false
  return Boolean(
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function' &&
    navigator.credentials,
  )
}

export const createMeraAccount = async (
  username: string = 'monad-holder',
): Promise<MeraAccountSession> => {
  const rpId = getRelyingPartyId()
  const res = await createPasskeyWithPrfOutput({
    rp: { id: rpId, name: 'Aver Proof of Funds' },
    user: {
      name: `${username}@aver.fund`,
      displayName: username,
    },
  })

  const privateKey = deriveEvmKey(res.prfOutput)
  const signingSession = createSecp256k1SigningSession({ privateKey })
  const account = toViemAccount(signingSession)

  return {
    address: account.address,
    account,
    authType: 'mera-passkey',
  }
}

export const loginMeraAccount = async (): Promise<MeraAccountSession> => {
  const rpId = getRelyingPartyId()
  const res = await getPasskeyPrfOutput({ rpId })

  const privateKey = deriveEvmKey(res.prfOutput)
  const signingSession = createSecp256k1SigningSession({ privateKey })
  const account = toViemAccount(signingSession)

  return {
    address: account.address,
    account,
    authType: 'mera-passkey',
  }
}
