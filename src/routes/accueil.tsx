import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { BottomNav, Phone, PrimaryButton, SchematicMap } from '@/components/yoonu'
import { getHomeData, searchPlaces } from '@/server/yoonu'

export const Route = createFileRoute('/accueil')({
  loader: () => getHomeData(),
  component: Accueil,
})

function Accueil() {
  const data = Route.useLoaderData()
  const nav = useNavigate()
  const [from, setFrom] = useState('Castor')
  const [to, setTo] = useState('')
  const [showLoc, setShowLoc] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<typeof data.places>([])
  const [confirm, setConfirm] = useState<null | { name: string; area: string }>(null)

  useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      if (!query.trim() && !to.trim()) {
        setResults([])
        return
      }
      const r = await searchPlaces({ data: query || to })
      if (alive) setResults(r)
    }, 200)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query, to])

  const pickPlace = (name: string, area: string) => {
    setTo(name)
    setQuery(name)
    setConfirm({ name, area })
    setResults([])
  }

  if (confirm) {
    return (
      <Phone>
        <div className="px-5 pt-2">
          <h1 className="text-[16px] font-semibold">Yoonu Bus</h1>
          <div className="mt-3 rounded-xl border border-[#E3E8F3] bg-white p-3">
            <p className="flex items-center gap-2 font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1F5EFF] text-[12px] font-bold text-white">A</span> {from} <button onClick={() => setConfirm(null)} className="ml-auto rounded-lg border px-3 py-1 text-[14px]">Modifier</button></p>
            <p className="pl-9 text-[13px] text-[#5B6785]">Départ sélectionné</p>
          </div>
          <div className="mt-2 rounded-xl border-2 border-[#F5B800] bg-[#FFFBEA] p-3">
            <p className="flex items-center gap-2 font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5B800] text-[12px] font-bold text-[#0F1B3D]">B</span> {confirm.name} <span className="ml-auto rounded-lg border bg-white px-3 py-1 text-[14px]">Modifier</span></p>
          </div>
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#FFF1D6] px-3 py-1 text-[13px] font-medium text-[#B26A00]">📍 Point d'arrivée à confirmer</p>
          <h2 className="mt-2 text-[26px] font-bold">C'est bien ici ?</h2>
          <p className="text-[14px] text-[#5B6785]">On a localisé votre destination sur la carte. Confirmez ou ajustez si besoin.</p>
          <div className="mt-3">
            <SchematicMap variant="route" />
            <p className="mt-2 rounded-xl bg-white p-3 text-[13px] text-[#5B6785]">✎ Pas exactement là ? Touchez la carte pour ajuster.</p>
          </div>
          <div className="mt-3 space-y-2 pb-4">
            <PrimaryButton onClick={() => nav({ to: '/itineraire' as never, search: { from, to: confirm.name } as never })}>Oui, c'est bien ici !</PrimaryButton>
            <button onClick={() => setConfirm(null)} className="flex h-14 w-full items-center justify-center rounded-full border border-[#1F5EFF] font-semibold text-[#0B3BCC]">Non, chercher un autre endroit</button>
          </div>
        </div>
        <BottomNav active="accueil" />
      </Phone>
    )
  }

  return (
    <Phone>
      <div className="rounded-b-[24px] bg-[#1F5EFF] px-5 pb-6 pt-2">
        <div className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[13px] font-bold"><span>📍</span> yoonubus</div>
        <h1 className="mt-3 text-[22px] font-bold text-white">Bonjour 👋</h1>
        <p className="text-white/90">Où vas-tu aujourd'hui ?</p>
      </div>
      <div className="-mt-3 rounded-t-[24px] bg-[#F6F8FB] px-5 pt-5">
        <p className="text-[13px] font-bold">DÉPART</p>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#E3E8F3] bg-white px-3 py-3">
          <span className="h-3 w-3 rounded-full bg-[#1F5EFF]" />
          <input value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-transparent font-medium outline-none" aria-label="Départ" />
        </div>
        <div className="my-1 flex justify-center"><button onClick={() => { setFrom(to || from); setTo(from) }} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5A623] text-white" aria-label="Inverser">⇄</button></div>
        <p className="text-[13px] font-bold">DESTINATION</p>
        <div className="mt-1 flex items-center gap-2 rounded-xl border-2 border-[#1F5EFF] bg-[#E8EFFF] px-3 py-3">
          <span>🔖</span>
          <input
            value={query || to}
            onChange={(e) => { setTo(e.target.value); setQuery(e.target.value) }}
            placeholder="Où vas-tu ?"
            className="w-full bg-transparent font-medium outline-none placeholder:text-[#5B6785]"
            aria-label="Destination"
          />
          {to && <button onClick={() => { setTo(''); setQuery('') }} className="text-[#5B6785]" aria-label="Effacer">✕</button>}
        </div>

        {(query || to) && results.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-[#E3E8F3] bg-white">
            <p className="bg-[#FFF8EC] px-4 py-2 text-[13px] font-medium">Plusieurs lieux correspondent à « {query || to} » — choisis le bon lieu.</p>
            {results.map((p) => (
              <button key={p.id} onClick={() => pickPlace(p.name, p.area)} className="flex w-full items-center gap-3 border-t border-[#E3E8F3] px-4 py-3 text-left hover:bg-[#F6F8FB]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8EFFF]">📍</span>
                <span className="flex-1"><span className="block font-semibold">{p.name}</span><span className="block text-[13px] text-[#5B6785]">{p.kind} · {p.area}</span></span>
                <span>›</span>
              </button>
            ))}
            <button onClick={() => pickPlace('Zone ISM / « Université »', 'Sicap Liberté')} className="flex w-full items-center gap-3 border-2 border-[#F5B800] bg-[#FFFBEA] px-4 py-3 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1D6]">⌂</span>
              <span className="flex-1"><span className="block font-semibold">Zone ISM / « Université »</span><span className="mt-1 inline-block rounded-full bg-[#F5B800] px-2 py-0.5 text-[12px] font-semibold">Arrêt annoncé par le Tata 24</span><span className="block text-[13px] text-[#5B6785]">Je t'alerterai quand descendre</span></span>
              <span>›</span>
            </button>
          </div>
        )}

        <div className="mt-3">
          <PrimaryButton onClick={() => (to ? setConfirm({ name: to, area: 'Dakar' }) : setShowLoc(true))}>C'est parti !</PrimaryButton>
        </div>

        <div className="mt-4"><SchematicMap variant="home" /></div>

        <div className="mt-4 flex items-center justify-between">
          <h2 className="font-bold tracking-wide">LIEUX RÉCENTS</h2>
          <span className="font-semibold">Voir tout</span>
        </div>
        <div className="mt-1 divide-y divide-[#E3E8F3]">
          <button onClick={() => pickPlace('ISM Dakar', 'Sicap Liberté')} className="flex w-full items-center gap-3 py-3 text-left">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF1D6]">💼</span>
            <span className="flex-1"><span className="block font-semibold">ISM Dakar</span><span className="text-[13px] text-[#5B6785]">Établissement · Sicap Liberté</span></span><span>→</span>
          </button>
          <button onClick={() => setFrom('Castor')} className="flex w-full items-center gap-3 py-3 text-left">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8EFFF]">◉</span>
            <span className="flex-1"><span className="block font-semibold">Castor</span><span className="text-[13px] text-[#5B6785]">Quartier · Dakar</span></span><span>→</span>
          </button>
        </div>
        <div className="h-4" />
      </div>
      {showLoc && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1A1000]/45">
          <div className="w-full max-w-[480px] rounded-t-[28px] bg-white p-6">
            <div className="mx-auto h-1 w-10 rounded-full bg-[#E3E8F3]" />
            <div className="mx-auto mt-4 flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[#FFF1D6]"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F5A623] text-3xl">🚌</span></div>
            <h2 className="mt-4 text-[22px] font-bold leading-snug">Utilise ta position pour voyager sereinement</h2>
            <p className="mt-2 text-[14px] text-[#5B6785]">On utilise ta position uniquement pour t'aider à choisir ton départ et suivre ta propre position pendant ton trajet. On ne localise jamais les bus.</p>
            <p className="mt-2 text-[12px] font-semibold text-[#059669]">🛡 Ta position, pour ton trajet<br /><span className="font-normal text-[#5B6785]">Le GPS ne localise pas les bus.</span></p>
            <div className="mt-4 space-y-2 pb-2">
              <PrimaryButton onClick={() => setShowLoc(false)}>Autoriser ma position</PrimaryButton>
              <button onClick={() => setShowLoc(false)} className="flex h-14 w-full items-center justify-center rounded-full border border-[#1F5EFF] font-semibold text-[#0B3BCC]">Saisir mon départ</button>
              <p className="text-[12px] text-[#5B6785]">Le partage de position pour aider la communauté est optionnel et désactivable à tout moment.</p>
            </div>
          </div>
        </div>
      )}
      <BottomNav active="accueil" />
    </Phone>
  )
}
