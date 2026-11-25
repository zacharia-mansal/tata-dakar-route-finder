import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'
import { parsePlaceSelection } from '@/lib/transit-api'
import { useAction } from '@/lib/actions'
import { toggleSave } from '@/server/yoonu'
import { searchTransitRoutes as searchPublishedRoutes } from '@/server/transit'

type SearchParams = { origin: string; destination: string; from: string; to: string; journey: string; network: 'aftu_dakar' | 'tata_thies' | string }

function validateSearch(search: Record<string, unknown>): SearchParams {
  return {
    origin: typeof search.origin === 'string' ? search.origin : '',
    destination: typeof search.destination === 'string' ? search.destination : '',
    from: typeof search.from === 'string' ? search.from : '',
    to: typeof search.to === 'string' ? search.to : '',
    journey: typeof search.journey === 'string' ? search.journey : '',
    network: typeof search.network === 'string' ? search.network : 'aftu_dakar',
  }
}

function parseSelectionJson(value: string) {
  try {
    return parsePlaceSelection(JSON.parse(value) as unknown)
  } catch {
    return undefined
  }
}

export const Route = createFileRoute('/parcours')({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const search = deps as SearchParams
    const origin = parseSelectionJson(search.origin)
    const destination = parseSelectionJson(search.destination)
    if (!origin || !destination) {
      return { ok: false as const, code: 'invalid_selection', message: 'Reviens à l’accueil pour choisir tes lieux.' }
    }
    return searchPublishedRoutes({ data: { network: search.network, origin, destination, locale: 'fr' } })
  },
  component: Parcours,
})

function deviceId() {
  try {
    let value = localStorage.getItem('yb-device') ?? ''
    if (!value) {
      value = crypto.randomUUID()
      localStorage.setItem('yb-device', value)
    }
    return value
  } catch {
    return 'web'
  }
}

function Parcours() {
  const result = Route.useLoaderData()
  const search = Route.useSearch() as SearchParams
  const [saved, setSaved] = useState(false)
  const save = useAction(async () => {
    if (!result.ok || result.data.kind !== 'routes') return { saved: false }
    const journey = result.data.routes.find((item) => item.id === search.journey)
    if (!journey) return { saved: false }
    const lines = [...new Set(journey.legs.map((leg) => leg.lineNumber))]
    return toggleSave({ data: {
      deviceId: deviceId(),
      kind: 'journey',
      refId: journey.id,
      title: `Tata ${lines.join(', ')}`,
      subtitle: `${search.from} → ${journey.servedAreaName} → ${search.to}`,
    } })
  }, { onSuccess: (value) => setSaved((value as { saved: boolean }).saved) })

  const journey = result.ok && result.data.kind === 'routes'
    ? result.data.routes.find((item) => item.id === search.journey)
    : undefined

  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2">
        <Link to="/itineraire" search={search as never} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E3E8F3]" aria-label="Retour aux résultats"><FigmaIcon name="arrow-left" size={24} /></Link>
        <h1 className="text-[17px] font-bold">Parcours et arrêts</h1>
      </div>
      <div className="mt-3 flex-1 px-4 pb-4">
        {!result.ok && <p className="rounded-xl bg-[#FDE8EA] p-4 text-[14px]" role="alert">{result.message}</p>}
        {result.ok && result.data.kind === 'no_verified_journey' && (
          <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4" role="status">
            <h2 className="text-[20px] font-bold">Aucun trajet vérifié trouvé</h2>
            <p className="mt-2 text-[14px] text-[#5B6785]">Cela ne signifie pas qu’aucun bus ne passe dans cette zone.</p>
          </div>
        )}
        {result.ok && result.data.kind === 'routes' && !journey && (
          <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4" role="alert">
            <h2 className="font-bold">Ce trajet n’est plus disponible dans les résultats</h2>
            <Link to="/itineraire" search={search as never} className="mt-3 flex h-12 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Revoir les trajets</Link>
          </div>
        )}
        {journey && (
          <>
            <section className="rounded-[20px] bg-[#E8EFFF] p-5">
              <p className="text-[13px] text-[#5B6785]">{search.from} → {search.to}</p>
              <h2 className="mt-1 text-[21px] font-bold">Zone desservie : {journey.servedAreaName}</h2>
              <p className="mt-2 text-[14px] text-[#5B6785]">{journey.totalWalkMeters} m de marche · {journey.legs.reduce((sum, leg) => sum + leg.orderedStops.length, 0)} repères vérifiés</p>
              {journey.legs.map((leg) => (
                <p key={leg.directionId} className="mt-3 text-[16px] font-bold text-[#0B3BCC]">Dis au receveur : « {leg.receiverQuestion} »</p>
              ))}
              <p className="mt-2 text-[12px] text-[#5B6785]">Vérifié le {new Date(journey.verifiedAt).toLocaleDateString('fr-FR')}</p>
            </section>

            <section className="mt-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4">
              <h3 className="text-[17px] font-bold">Détail du trajet</h3>
              <p className="mt-1 text-[13px] text-[#5B6785]">Les repères indiquent les arrêts connus. Ils ne représentent pas la route exacte du bus.</p>
              {journey.legs.map((leg) => (
                <div key={leg.directionId} className="mt-4">
                  <p className="rounded-lg bg-[#E8EFFF] px-3 py-2 font-bold">Tata {leg.lineNumber} · direction {leg.directionName}</p>
                  <p className="mt-2 text-[14px] text-[#5B6785]">Monte à {leg.boardingStop.name} · descends à {leg.alightingStop.name}</p>
                  <ol className="mt-2">
                    {leg.orderedStops.map((stop, index) => (
                      <li key={`${leg.directionId}:${stop.id}:${index}`} className="flex items-center gap-3 py-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8EFFF] text-[12px] font-bold text-[#1F5EFF]">{index + 1}</span>
                        <span className="font-medium">{stop.name}</span>
                      </li>
                    ))}
                  </ol>
                  {leg.walkBefore && <p className="rounded-xl bg-[#F6F8FB] p-3 text-[14px] text-[#5B6785]">Marche avant le bus : {leg.walkBefore.distanceMeters} m</p>}
                </div>
              ))}
              <p className="mt-3 rounded-xl bg-[#F6F8FB] p-3 text-[14px] text-[#5B6785]">Dernière marche : {journey.finalWalk.distanceMeters} m</p>
            </section>

            <section className="mt-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4">
              <h3 className="font-bold">Carte</h3>
              <p className="mt-1 text-[14px] text-[#5B6785]">La carte détaillée n’est pas encore connectée. Nous préférons ne pas tracer une route approximative comme si elle était exacte.</p>
            </section>

            <div className="mt-3 space-y-2">
              <button onClick={() => save.run()} disabled={save.pending} className="flex h-14 w-full items-center justify-center gap-2 rounded-full border border-[#E3E8F3] bg-white font-semibold disabled:opacity-60">
                {save.pending ? 'Enregistrement…' : saved ? '✓ Trajet enregistré' : 'Enregistrer ce trajet'}
              </button>
              {save.error && <p className="text-center text-[13px] text-[#D92D3A]" role="alert">Impossible d’enregistrer ce trajet pour le moment.</p>}
            </div>
          </>
        )}
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}
