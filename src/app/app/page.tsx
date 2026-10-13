import { HolderDashboard } from '@/components/holder-dashboard'
import { getContractAddresses } from '@/lib/chain-config'

export default function AppPage() {
  const contracts = getContractAddresses()

  return (
    <div className='flex-1 py-10 sm:py-14 px-4 sm:px-6 max-w-5xl mx-auto w-full'>
      <div className='mb-8'>
        <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700 text-xs font-mono tracking-wider mb-3'>
          <span className='w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse' />
          Certificate Authority
        </div>
        <h1 className='text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900'>
          Holder Portal
        </h1>
        <p className='text-sm text-slate-600 mt-1.5 max-w-xl'>
          Connect with browser wallet or biometric passkey to seal and anchor
          provable proof-of-funds certificates on Monad testnet.
        </p>
      </div>

      <HolderDashboard contractAddresses={contracts} />
    </div>
  )
}
