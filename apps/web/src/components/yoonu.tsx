import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="yb-phone flex min-h-[100dvh] flex-col">
      <div className="flex items-center justify-between px-6 pt-3 text-[12px] font-semibold text-[#0F1B3D]">
        <span>9:41</span>
        <span className="flex items-center gap-1 text-[#0F1B3D]">
          <FigmaIcon name="status-network" width={20} height={14} />
          <FigmaIcon name="status-wifi" width={16} height={14} />
          <FigmaIcon name="status-battery" width={25} height={14} />
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

type FigmaIconName =
  | 'arrow-left'
  | 'bookmark'
  | 'bookmark-active'
  | 'bus-stop'
  | 'chevron-right'
  | 'circle'
  | 'circle-dot'
  | 'circle-help'
  | 'circle-plus'
  | 'circle-plus-active'
  | 'dot'
  | 'flag'
  | 'home'
  | 'home-active'
  | 'location'
  | 'map-pin'
  | 'search'
  | 'shield'
  | 'status-battery'
  | 'status-network'
  | 'status-wifi'
  | 'user'
  | 'user-active'

export function FigmaIcon({
  name,
  size,
  width,
  height,
}: {
  name: FigmaIconName
  size?: number
  width?: number
  height?: number
}) {
  return <img src={`/icons/${name}.svg`} width={width ?? size} height={height ?? size} alt="" aria-hidden="true" />
}

export function BottomNav({ active }: { active: 'accueil' | 'enregistres' | 'contribuer' | 'profil' }) {
  const items = [
    { id: 'accueil', label: 'Accueil', to: '/accueil', icon: 'home' },
    { id: 'enregistres', label: 'Enregistrés', to: '/enregistres', icon: 'bookmark' },
    { id: 'contribuer', label: 'Contribuer', to: '/contribuer', icon: 'circle-plus' },
    { id: 'profil', label: 'Profil', to: '/profil', icon: 'user' },
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
              <span className={cn('flex h-8 w-16 items-center justify-center rounded-full', on && 'bg-[#E8EFFF]')}>
                <FigmaIcon name={on ? `${it.icon}-active` as FigmaIconName : it.icon} size={22} />
              </span>
              {it.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-semibold uppercase tracking-[0.4px] text-[#5B6785]">{children}</p>
}
