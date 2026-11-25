import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { BottomNav, Phone, PrimaryButton } from '@/components/yoonu'
import { getItinerary } from '@/server/yoonu'

const searchSchema = z.object({ from: z.string().optional(), to: z.string().optional() })

export const Route = createFileRoute('/itineraire')({
  validateSearch: (s: Record<string, unknown>) => ({
    from: typeof s.from === 'string' ? s.from : 'Castor',
    to: typeof s.to === 'string' ? s.to : 'ISM Dakar',
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getItinerary({ data: { from: (deps as { from: string }).from, to: (deps as { to: string }).to } }),
  component: Itineraire,
})

function Itineraire() {
  const itin = Route.useLoaderData()
  const search = Route.useSearch() as { from: string; to: string }
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2">
        <Link to="/accueil" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E3E8F3]">←</Link>
        <div><h1 className="text-[18px] font-bold">{search.to}</h1><p className="text-[13px] text-[#5B6785]">🟡 Depuis {search.from} · Tu es ici</p></div>
      </div>
      <div className="mt-2 flex items-center gap-3 bg-[#FFFBEB] px-5 py-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5B800]">📍</span>
        <p><strong>On t'accompagne pas à pas</strong><br /><span className="text-[14px] text-[#5B6785]">Tu sauras exactement où descendre.</span></p>
      </div>
      <div className="px-5 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-[17px] font-semibold">1 itinéraire proposé</p>
          <span className="rounded-full bg-[#E7F5ED] px-3 py-1 text-[13px] font-semibold text-[#12A150]">Trajet vérifié ✓</span>
        </div>
        <div className="mt-2 rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-[#1F5EFF] px-3 py-1.5 text-[16px] font-bold text-white">Tata 24</span>
              <span className="rounded-lg border border-[#F5B800] bg-[#FFFBEB] px-2 py-1 text-[13px] font-semibold text-[#B26A00]">Direct</span>
            </div>
            <p className="text-right text-[32px] font-bold leading-none">27 min<br /><span className="text-[13px] font-normal text-[#5B6785]">environ</span></p>
          </div>
          <h2 className="mt-2 text-[20px] font-bold">Direction Université</h2>
          <p className="text-[14px] text-[#5B6785]">6 min à pied · 18 min en bus · 3 min à pied</p>
          <hr className="my-3 border-[#E3E8F3]" />
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#5B6785]">Ton itinéraire pas à pas</p>
          <div className="mt-1">
            {itin.stops.slice(0, 4).map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8EFFF]">•</span>
                <span><span className="block font-semibold">{s.name}</span><span className="text-[14px] text-[#5B6785]">{s.walkInfo ?? 'Point de montée'}</span></span>
              </div>
            ))}
          </div>
          <hr className="my-3 border-[#E3E8F3]" />
          <div className="rounded-xl border border-[#F5B800] bg-[#FFFBEB] p-3">
            <p className="text-[13px] font-semibold text-[#B26A00]">Dis au receveur</p>
            <p className="text-[18px] font-bold text-[#0B3BCC]">« Université »</p>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[15px] font-medium text-[#12A150]">● Trajet vérifié</p>
          <div className="mt-2">
            <Link to="/parcours" search={{ from: search.from, to: search.to } as never} className="flex h-14 w-full items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Voir ce trajet</Link>
          </div>
        </div>
        <div className="h-4" />
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}

export const _p = PrimaryButton
export const _z = searchSchema
