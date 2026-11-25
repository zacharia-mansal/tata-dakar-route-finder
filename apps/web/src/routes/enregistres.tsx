import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { BottomNav, Phone } from '@/components/yoonu'
import { listSaved } from '@/server/yoonu'
import { useAction } from '@/lib/actions'

type SavedRow = { title: string; subtitle?: string | null; kind: string; refId: string }

function deviceId() {
  try {
    let v = localStorage.getItem('yb-device')
    if (!v) {
      v = crypto.randomUUID()
      localStorage.setItem('yb-device', v)
    }
    return v
  } catch { return 'web' }
}

export const Route = createFileRoute('/enregistres')({
  // SSR-safe : le premier rendu serveur renvoie une liste vide stable.
  // L'identifiant appareil (localStorage) n'existe que dans le navigateur,
  // donc la vraie liste est chargée côté client dans un effet (voir ci-dessous).
  loader: async (): Promise<SavedRow[]> => [],
  component: Enregistres,
})

function Enregistres() {
  const initial = Route.useLoaderData() as SavedRow[]
  const [saved, setSaved] = useState<SavedRow[]>(initial)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const fetchSaved = async () => {
    try {
      const rows = await listSaved({ data: deviceId() })
      setSaved((rows ?? []) as SavedRow[])
      setLoadError(null)
    } catch {
      setLoadError("Impossible de charger tes enregistrements pour l'instant. Vérifie ta connexion puis réessaie.")
    } finally {
      setLoaded(true)
    }
  }
  const retry = useAction(fetchSaved)
  useEffect(() => {
    fetchSaved()
  }, [])
  if (!loaded) {
    return (
      <Phone>
        <div className="flex items-center gap-3 px-5 pt-2"><Link to="/accueil">←</Link><h1 className="text-[18px] font-bold">Enregistrés</h1></div>
        <div className="px-5 py-10 text-center" role="status" aria-live="polite">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E8EFFF] text-3xl">🔖</span>
          <p className="mt-3 font-semibold text-[#0F1B3D]">Chargement de tes enregistrements…</p>
        </div>
        <div className="flex-1" />
        <BottomNav active="enregistres" />
      </Phone>
    )
  }
  const hasTata = saved.some((s) => s.refId.includes('tata24'))
  const count = saved.length + (hasTata ? 2 : 3)
  if (saved.length === 0 && !hasTata) {
    return (
      <Phone>
        <div className="flex items-center gap-3 px-5 pt-2"><Link to="/accueil">←</Link><h1 className="text-[18px] font-bold">Enregistrés</h1></div>
        <div className="bg-[#1F5EFF] px-5 py-6 text-white">
          <span className="rounded-full bg-[#F5B800] px-3 py-1 text-[13px] font-bold text-[#0F1B3D]">⭐ Tes favoris</span>
          <h2 className="mt-2 text-[22px] font-bold leading-tight">Tes repères, toujours avec toi</h2>
          <p>Retrouve tes trajets, même sans connexion.</p>
        </div>
        {loadError && (
          <div role="alert" className="mx-5 mt-4 rounded-2xl border border-[#F5C518] bg-[#FFFBEA] p-4">
            <p className="text-[14px] font-medium text-[#0F1B3D]">{loadError}</p>
            <button onClick={() => retry.run()} className="mt-2 flex h-12 w-full items-center justify-center rounded-full border border-[#1F5EFF] bg-white font-semibold text-[#0B3BCC]">{retry.pending ? 'Chargement…' : 'Réessayer'}</button>
          </div>
        )}
        <div className="px-5 py-8 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E8EFFF] text-3xl">🔖</span>
          <h3 className="mt-3 text-[18px] font-bold">Rien d'enregistré pour l'instant</h3>
          <p className="mt-1 text-[14px] text-[#5B6785]">Enregistre un trajet depuis sa fiche pour le retrouver hors-ligne.</p>
          <Link to="/accueil" className="mt-4 flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Trouver un trajet</Link>
        </div>
        <div className="flex-1" />
        <BottomNav active="enregistres" />
      </Phone>
    )
  }
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/accueil">←</Link><h1 className="text-[18px] font-bold">Enregistrés</h1></div>
      <div className="bg-[#1F5EFF] px-5 py-6 text-white">
        <span className="rounded-full bg-[#F5B800] px-3 py-1 text-[13px] font-bold text-[#0F1B3D]">⭐ Tes favoris</span>
        <h2 className="mt-2 text-[24px] font-bold leading-tight">Tes repères, toujours avec toi</h2>
        <p>Retrouve tes trajets, même sans connexion.</p>
      </div>
      <div className="px-5 pt-4">
        {loadError && (
          <div role="alert" className="mb-3 rounded-2xl border border-[#F5C518] bg-[#FFFBEA] p-4">
            <p className="text-[14px] font-medium text-[#0F1B3D]">{loadError}</p>
            <button onClick={() => retry.run()} className="mt-2 flex h-12 w-full items-center justify-center rounded-full border border-[#1F5EFF] bg-white font-semibold text-[#0B3BCC]">{retry.pending ? 'Chargement…' : 'Réessayer'}</button>
          </div>
        )}
        <div className="rounded-[20px] bg-[#E8EFFF] p-4">
          <span className="rounded-full bg-[#E7F5ED] px-3 py-1 text-[13px] font-medium text-[#12A150]">Disponible hors ligne</span>
          <p className="mt-2 text-[17px] font-bold">{count} éléments · 12,4 Mo utilisés</p>
          <p className="text-[13px] text-[#5B6785]">Enregistrés sur ce téléphone · Gérer le stockage →</p>
        </div>
        <h3 className="mt-4 font-bold">Trajets · 1</h3>
        <div className="mt-2 rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <p className="flex justify-between font-semibold">TRAJET DIRECT <span>→</span></p>
          <p className="mt-1 text-[18px] font-bold">Tata 24 · direction Université</p>
          <span className="mt-1 inline-block rounded-lg bg-[#E7F5ED] px-2 py-0.5 text-[13px] text-[#12A150]">Trajet vérifié</span>
          <p className="mt-2 font-medium">Castor → Université → ISM Dakar</p>
          <p className="text-[14px] text-[#5B6785]">Descends à l'arrêt « Université »</p>
          <p className="text-[14px] text-[#5B6785]">Marche 3 min jusqu'à l'ISM</p>
          <Link to="/parcours" search={{ from: 'Castor', to: 'ISM Dakar' } as never} className="mt-3 flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Voir le trajet</Link>
        </div>
        <h3 className="mt-4 font-bold">Lignes · 1</h3>
        <Link to="/ligne" className="mt-2 flex items-center gap-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4 text-[#0F1B3D]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8EFFF] text-2xl">🚌</span>
          <span className="flex-1"><span className="block text-[17px] font-bold">Tata 24</span><span className="text-[14px] text-[#5B6785]">Castor – Université · les deux sens</span></span><span>›</span>
        </Link>
        <h3 className="mt-4 font-bold">Arrêts · 1</h3>
        <Link to="/arret" className="mt-2 flex items-center gap-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4 text-[#0F1B3D]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8EFFF] text-2xl">📍</span>
          <span className="flex-1"><span className="block text-[17px] font-bold">Université</span><span className="text-[14px] text-[#5B6785]">Sicap Liberté · voir l'arrêt</span></span><span>›</span>
        </Link>
        {saved.filter((s) => !s.refId.includes('tata24')).map((s) => (
          <div key={s.refId} className="mt-2 rounded-[20px] border border-[#E3E8F3] bg-white p-4">
            <p className="font-bold">{s.title}</p>
            <p className="text-[13px] text-[#5B6785]">{s.subtitle}</p>
          </div>
        ))}
        <p className="py-4 text-[13px] text-[#5B6785]">Dernière synchronisation : aujourd'hui à 08:30.</p>
      </div>
      <BottomNav active="enregistres" />
    </Phone>
  )
}

export const _d = deviceId
