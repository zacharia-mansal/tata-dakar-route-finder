import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'
import { listSaved } from '@/server/yoonu'
import { useAction } from '@/lib/actions'

type SavedRow = { title: string; subtitle?: string | null; kind: string; refId: string }

function deviceId() {
  try {
    let value = localStorage.getItem('yb-device')
    if (!value) {
      value = crypto.randomUUID()
      localStorage.setItem('yb-device', value)
    }
    return value
  } catch {
    return 'web'
  }
}

export const Route = createFileRoute('/enregistres')({ loader: async (): Promise<SavedRow[]> => [], component: Enregistres })

function Enregistres() {
  const [saved, setSaved] = useState<SavedRow[]>(Route.useLoaderData())
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchSaved = async () => {
    try {
      setSaved((await listSaved({ data: deviceId() }) ?? []) as SavedRow[])
      setLoadError(null)
    } catch {
      setLoadError('Impossible de charger tes enregistrements. Vérifie ta connexion puis réessaie.')
    } finally {
      setLoaded(true)
    }
  }

  const retry = useAction(fetchSaved)
  useEffect(() => { void fetchSaved() }, [])

  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/accueil" aria-label="Retour à l’accueil"><FigmaIcon name="arrow-left" size={24} /></Link><h1 className="text-[18px] font-bold">Enregistrés</h1></div>
      <div className="bg-[#1F5EFF] px-5 py-6 text-white">
        <h2 className="text-[22px] font-bold">Tes éléments enregistrés</h2>
        <p className="mt-1">Ils sont synchronisés avec ton compte ou cet appareil.</p>
      </div>
      <div className="flex-1 px-5 py-4">
        {!loaded && <p role="status" className="py-5 text-center text-[#5B6785]">Chargement…</p>}
        {loadError && <div role="alert" className="rounded-2xl border border-[#F5C518] bg-[#FFFBEA] p-4"><p>{loadError}</p><button onClick={() => retry.run()} className="mt-2 flex h-12 w-full items-center justify-center rounded-full border border-[#1F5EFF] bg-white font-semibold text-[#0B3BCC]">{retry.pending ? 'Chargement…' : 'Réessayer'}</button></div>}
        {loaded && !loadError && saved.length === 0 && (
          <div className="py-8 text-center">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E8EFFF]"><FigmaIcon name="bookmark" size={24} /></span>
            <h3 className="mt-3 text-[18px] font-bold">Rien d’enregistré pour l’instant</h3>
            <p className="mt-1 text-[14px] text-[#5B6785]">Enregistre un trajet depuis ses résultats pour le retrouver ici.</p>
            <Link to="/accueil" className="mt-4 flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Chercher un trajet</Link>
          </div>
        )}
        {saved.map((item) => (
          <article key={item.refId} className="mb-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4">
            <p className="font-bold">{item.title}</p>
            {item.subtitle && <p className="mt-1 text-[14px] text-[#5B6785]">{item.subtitle}</p>}
            <p className="mt-2 text-[12px] text-[#5B6785]">{item.kind === 'journey' ? 'Trajet enregistré' : 'Élément enregistré'}</p>
          </article>
        ))}
      </div>
      <BottomNav active="enregistres" />
    </Phone>
  )
}
