import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { BottomNav, Phone, SchematicMap } from '@/components/yoonu'
import { getItinerary } from '@/server/yoonu'

export const Route = createFileRoute('/ligne')({
  loader: () => getItinerary({ data: { from: 'Castor', to: 'ISM Dakar' } }),
  component: Ligne,
})

function Ligne() {
  const itin = Route.useLoaderData()
  const [sens, setSens] = useState<'aller' | 'retour'>('aller')
  const stops = sens === 'aller' ? itin.stops : [...itin.stops].reverse()
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/enregistres">←</Link><h1 className="text-[17px] font-bold">Ligne Tata 24 · {sens}</h1></div>
      <div className="px-5 pt-3">
        <div className="flex gap-2">
          {(['aller', 'retour'] as const).map((s) => (
            <button key={s} onClick={() => setSens(s)} className={`h-10 flex-1 rounded-full font-semibold ${sens === s ? 'bg-[#0F1B3D] text-white' : 'bg-white text-[#5B6785] border border-[#E3E8F3]'}`}>{s === 'aller' ? 'Aller · Castor → Université' : 'Retour · Université → Castor'}</button>
          ))}
        </div>
        <div className="mt-3 rounded-[20px] bg-[#E8EFFF] p-4">
          <p className="text-[15px] text-[#5B6785]">Tata 24 · {sens === 'aller' ? '27 min' : '29 min'} au total · <span className="text-[#12A150] font-semibold">Trajet vérifié</span></p>
          <p className="font-bold text-[#0B3BCC]">Dis au receveur : « {sens === 'aller' ? 'Université' : 'Castor'} »</p>
        </div>
        <div className="mt-3"><SchematicMap variant="route" /></div>
        <div className="mt-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <h2 className="font-bold">Arrêts {sens} · {stops.length}</h2>
          {stops.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8EFFF] text-[12px] font-bold">{i + 1}</span>
              <span><span className="block font-semibold">{s.name}</span><span className="text-[13px] text-[#5B6785]">{s.walkInfo}</span></span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 py-4">
          <Link to="/arret" className="flex h-12 flex-1 items-center justify-center rounded-full border border-[#1F5EFF] font-semibold text-[#0B3BCC]">Voir l'arrêt Université</Link>
          <Link to="/info" className="flex h-12 flex-1 items-center justify-center rounded-full bg-[#0F1B3D] font-semibold text-white">Source info</Link>
        </div>
      </div>
      <BottomNav active="enregistres" />
    </Phone>
  )
}
