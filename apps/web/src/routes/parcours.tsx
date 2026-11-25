import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { BottomNav, Phone, SchematicMap } from '@/components/yoonu'
import { getItinerary, toggleSave } from '@/server/yoonu'
import { useAction } from '@/lib/actions'

export const Route = createFileRoute('/parcours')({
  validateSearch: (s: Record<string, unknown>) => ({
    from: typeof s.from === 'string' ? s.from : 'Castor',
    to: typeof s.to === 'string' ? s.to : 'ISM Dakar',
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getItinerary({ data: { from: (deps as { from: string }).from, to: (deps as { to: string }).to } }),
  component: Parcours,
})

function deviceId() {
  let v = ''
  try {
    v = localStorage.getItem('yb-device') ?? ''
    if (!v) {
      v = crypto.randomUUID()
      localStorage.setItem('yb-device', v)
    }
  } catch { v = 'web' }
  return v
}

function Parcours() {
  const itin = Route.useLoaderData()
  const search = Route.useSearch() as { from: string; to: string }
  const [saved, setSaved] = useState(false)
  const save = useAction(
    async () => {
      const r = await toggleSave({ data: { deviceId: deviceId(), kind: 'trajet', refId: 'tata24-castor-ism', title: 'Tata 24 · direction Université', subtitle: `${search.from} → Université → ${search.to}` } })
      return r
    },
    { onSuccess: (r) => setSaved((r as { saved: boolean }).saved) },
  )

  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2">
        <Link to="/itineraire" search={search as never} className="flex h-10 w-10 items-center justify-center rounded-full">←</Link>
        <h1 className="text-[17px] font-bold">Parcours et arrêts</h1>
        <span className="ml-auto rounded bg-white px-2 py-1 text-[12px] font-bold">📍 yoonubus</span>
      </div>
      <div className="mx-4 mt-3 rounded-[20px] bg-[#E8EFFF] p-5">
        <div className="flex items-start justify-between">
          <h2 className="text-[22px] font-bold leading-tight">Direction Université</h2>
          <span className="rounded-full border border-[#E3E8F3] bg-white px-2 py-0.5 text-[13px]">En bus</span>
        </div>
        <p className="text-[15px] text-[#5B6785]">Tata 24 · 27 min au total</p>
        <p className="mt-3 text-[17px] font-bold text-[#0B3BCC]">Dis au receveur :<br />« Université »</p>
      </div>
      <div className="mx-4 mt-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4">
        <div className="flex items-center justify-between"><h3 className="text-[17px] font-bold">Carte</h3><span className="rounded-lg bg-[#E7F5ED] px-2 py-0.5 text-[13px] font-medium text-[#12A150]">Trajet vérifié</span></div>
        <div className="mt-2"><SchematicMap variant="route" /></div>
        <p className="mt-2 text-[13px] text-[#5B6785]">Bleu : départ · Marine : arrivée<br />Pointillés : marche</p>
      </div>
      <div className="mx-4 mt-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4">
        <div className="flex items-center justify-between"><h3 className="text-[17px] font-bold">Étapes du trajet</h3><span className="rounded-lg bg-[#E8EFFF] px-2 py-0.5 text-[13px]">8 arrêts en bus</span></div>
        <div className="mt-1">
          {itin.stops.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8EFFF]">•</span>
              <span><span className="block font-semibold">{s.name}</span><span className="text-[14px] text-[#5B6785]">{s.walkInfo ?? 'Point de montée'}</span></span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 pb-4 pt-3">
        <button onClick={() => save.run()} disabled={save.pending} className="flex h-14 w-full items-center justify-center gap-2 rounded-full border border-[#E3E8F3] bg-white font-semibold">
          {save.pending ? 'Enregistrement…' : saved ? '✓ Enregistré hors-ligne' : '⬇ Enregistrer pour hors-ligne'}
        </button>
        {save.error && <p className="mt-1 text-center text-[13px] text-red-600">{String(save.error)}</p>}
        <Link to="/suivi" search={search as never} className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#1F5EFF] font-semibold text-white">🏠 Démarrer mon suivi</Link>
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}
