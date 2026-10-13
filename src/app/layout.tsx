import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import './globals.css'

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Aver — Proof of Funds That Stays True',
  description:
    'Living, killable, and lockable proof-of-funds certificates on Monad testnet.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang='en' className={`${geistMono.variable} h-full antialiased`}>
      <body className='min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] relative overflow-x-hidden'>
        <div className='ambient-glow' aria-hidden='true' />

        <aside
          aria-label='Testnet Notice'
          className='relative z-20 border-b border-slate-200 bg-slate-100/80 backdrop-blur-xs text-slate-600 text-[11px] py-1.5 px-4 text-center font-mono tracking-wider'
        >
          <span className='inline-flex items-center gap-1.5 text-rose-700 font-semibold'>
            <span className='w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse' />
            MONAD TESTNET
          </span>
          <span className='mx-2 text-slate-400'>·</span>
          <span>Chain ID 10143</span>
          <span className='mx-2 text-slate-400'>·</span>
          <span>Zero Monetary Value</span>
        </aside>

        <header className='relative z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0'>
          <div className='max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between'>
            <Link href='/' className='flex items-center gap-2.5 group'>
              <div className='w-8 h-8 rounded-lg border border-rose-200 bg-rose-50 flex items-center justify-center text-rose-600 transition duration-200 group-hover:border-rose-300 group-hover:bg-rose-100/60'>
                <ShieldCheck className='w-4.5 h-4.5' />
              </div>
              <div className='flex items-baseline gap-2'>
                <span className='text-lg font-extrabold tracking-tight text-slate-900'>
                  Aver
                </span>
                <span className='text-[10px] font-mono uppercase tracking-widest text-slate-500'>
                  Proof of Funds
                </span>
              </div>
            </Link>

            <nav className='flex items-center gap-1.5 sm:gap-2 font-mono text-xs'>
              <Link
                href='/'
                className='px-3 py-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition'
              >
                Overview
              </Link>
              <Link
                href='/app'
                className='px-3.5 py-1.5 rounded-md bg-slate-900 text-white font-medium hover:bg-slate-800 transition shadow-xs'
              >
                Holder App
              </Link>
            </nav>
          </div>
        </header>

        <main className='flex-1 flex flex-col relative z-10'>{children}</main>

        <footer className='relative z-20 border-t border-slate-200 bg-white py-8 text-xs text-slate-500'>
          <div className='max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4'>
            <div className='flex items-center gap-2'>
              <div className='w-2 h-2 rounded-full bg-emerald-600' />
              <span className='font-semibold text-slate-900'>
                Aver Protocol
              </span>
              <span>— Proof of funds that stays true.</span>
            </div>
            <div className='flex items-center gap-6 font-mono text-[11px] text-slate-500'>
              <a
                href='https://testnet.monadscan.com'
                target='_blank'
                rel='noopener noreferrer'
                className='hover:text-slate-900 transition'
              >
                MonadScan Explorer
              </a>
              <a
                href='https://faucet.monad.xyz'
                target='_blank'
                rel='noopener noreferrer'
                className='hover:text-slate-900 transition'
              >
                Monad Faucet
              </a>
              <span>Block Time: ~300ms</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
