import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="yb-phone flex min-h-[100dvh] flex-col">
      <div className="flex items-center justify-between px-6 pt-3 text-[12px] font-semibold text-[#0F1B3D]">
        <span>9:41</span>
        <span className="flex items-center gap-1 text-[#0F1B3D]">
          <span className="inline-block h-2 w-1 rounded-sm bg-current" />
          <span className="inline-block h-2.5 w-1 rounded-sm bg-current" />
          <span className="inline-block h-3 w-1 rounded-sm bg-current" />
          <span className="ml-1 inline-block h-3 w-6 rounded-sm border border-current" />
        </span>
      </div>
      {children}
      <div className="flex justify-center pb-2 pt-1">
        <div className="h-1 w-[108px] rounded-full bg-[#0F1B3D]" />
      </div>
    </div>
  )
}

export function PrimaryButton({
  children,
  to,
  onClick,
  className,
}: {
  children: ReactNode
  to?: string
  onClick?: () => void
  className?: string
}) {
  const cls = cn(
    'flex h-14 w-full items-center justify-center rounded-full bg-[#1F5EFF] px-6 text-[16px] font-semibold text-white shadow-sm transition hover:bg-[#0B3BCC] active:scale-[0.99] disabled:opacity-60',
    className,
  )
  if (to) return <Link to={to as never} className={cls}>{children}</Link>
  return <button type="button" onClick={onClick} className={cls}>{children}</button>
}

export function SecondaryButton({ children, to, onClick }: { children: ReactNode; to?: string; onClick?: () => void }) {
  const cls =
    'flex h-14 w-full items-center justify-center rounded-full border border-[#1F5EFF] bg-white px-6 text-[16px] font-semibold text-[#0B3BCC] transition hover:bg-[#E8EFFF] active:scale-[0.99]'
  if (to) return <Link to={to as never} className={cls}>{children}</Link>
  return <button type="button" onClick={onClick} className={cls}>{children}</button>
}

export function BottomNav({ active }: { active: 'accueil' | 'enregistres' | 'contribuer' | 'profil' }) {
  const items = [
    { id: 'accueil', label: 'Accueil', to: '/accueil', icon: '⌂' },
    { id: 'enregistres', label: 'Enregistrés', to: '/enregistres', icon: '▱' },
    { id: 'contribuer', label: 'Contribuer', to: '/contribuer', icon: '⊕' },
    { id: 'profil', label: 'Profil', to: '/profil', icon: '☺' },
  ] as const
  return (
    <nav className="sticky bottom-0 border-t border-[#E3E8F3] bg-white px-3 pb-2 pt-3">
      <div className="grid grid-cols-4 gap-1">
        {items.map((it) => {
          const on = active === it.id
          return (
            <Link
              key={it.id}
              to={it.to as never}
              className={cn('flex flex-col items-center gap-1 rounded-2xl py-1 text-[12px] font-medium', on ? 'text-[#1F5EFF]' : 'text-[#5B6785]')}
            >
              <span className={cn('flex h-8 w-16 items-center justify-center rounded-full text-[18px]', on && 'bg-[#E8EFFF]')}>{it.icon}</span>
              {it.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function SchematicMap({ variant = 'home' }: { variant?: 'home' | 'route' | 'gps' }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E3E8F3] bg-[#EAF0E9]">
      <div className="grid grid-cols-4 gap-1.5 p-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-11 rounded-md bg-[#D4E2D1]" style={{ opacity: 0.7 + (i % 3) * 0.12 }} />
        ))}
      </div>
      <svg viewBox="0 0 300 180" className="absolute inset-0 h-full w-full">
        {variant === 'home' && (
          <>
            <line x1="40" y1="30" x2="240" y2="30" stroke="#fff" strokeWidth="8" />
            <line x1="40" y1="90" x2="240" y2="90" stroke="#fff" strokeWidth="8" />
            <circle cx="200" cy="110" r="18" fill="#1F5EFF" opacity="0.2" />
            <circle cx="200" cy="110" r="9" fill="#1F5EFF" stroke="#fff" strokeWidth="3" />
          </>
        )}
        {variant !== 'home' && (
          <>
            <line x1="50" y1="20" x2="250" y2="160" stroke="#1F5EFF" strokeWidth="4" strokeLinecap="round" />
            <line x1="50" y1="20" x2="90" y2="50" stroke="#0F1B3D" strokeWidth="3" strokeDasharray="5 5" />
            <line x1="210" y1="130" x2="250" y2="160" stroke="#0F1B3D" strokeWidth="3" strokeDasharray="5 5" />
            <circle cx="50" cy="20" r="8" fill="#1F5EFF" stroke="#fff" strokeWidth="3" />
            <circle cx="120" cy="70" r="6" fill="#fff" stroke="#1F5EFF" strokeWidth="2.5" />
            <circle cx="170" cy="105" r="6" fill="#fff" stroke="#1F5EFF" strokeWidth="2.5" />
            <circle cx="250" cy="160" r="9" fill="#0F1B3D" stroke="#fff" strokeWidth="2.5" />
          </>
        )}
      </svg>
      {variant === 'home' && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[#0F1B3D] shadow">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1F5EFF]" /> Départ : Castor
        </div>
      )}
      {variant === 'route' && (
        <>
          <div className="absolute left-16 top-2 rounded-md bg-white/90 px-2 py-0.5 text-[13px] font-semibold">Départ : Castor</div>
          <div className="absolute left-32 top-16 rounded-md bg-white/90 px-2 py-0.5 text-[13px] font-semibold">Montée</div>
          <div className="absolute bottom-6 right-6 rounded-md bg-[#0F1B3D] px-2 py-0.5 text-[11px] font-bold text-white">D</div>
          <div className="absolute bottom-1 right-4 text-[13px] font-bold">ISM Dakar</div>
        </>
      )}
      {variant === 'gps' && (
        <div className="absolute left-1/3 top-1/3 rounded-lg bg-[#1F5EFF] px-2 py-1 text-[11px] font-semibold text-white">Vous êtes ici</div>
      )}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-semibold uppercase tracking-[0.4px] text-[#5B6785]">{children}</p>
}
