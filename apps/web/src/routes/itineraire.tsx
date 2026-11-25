import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'
import { parsePlaceSelection } from '@/lib/transit-api'
import { searchTransitRoutes } from '@/server/transit'

type SearchParams = { origin: string; destination: string; from: string; to: string; network: 'aftu_dakar' | 'tata_thies' | string }

function validateSearch(search: Record<string, unknown>): SearchParams {
  return {
    origin: typeof search.origin === 'string' ? search.origin : '',
    destination: typeof search.destination === 'string' ? search.destination : '',
    from: typeof search.from === 'string' ? search.from : '',
    to: typeof search.to === 'string' ? search.to : '',
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

export const Route = createFileRoute('/itineraire')({
  validateSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const search = deps as SearchParams
    const origin = parseSelectionJson(search.origin)
    const destination = parseSelectionJson(search.destination)
    if (!origin || !destination) {
      return { ok: false as const, code: 'invalid_selection', message: 'Reviens à l’accueil et choisis ton départ et ta destination dans la liste.' }
    }
    return searchTransitRoutes({ data: { network: search.network, origin, destination, locale: 'fr' } })
  },
  component: Itineraire,
})

function Itineraire() {
  const result = Route.useLoaderData()
  const search = Route.useSearch() as SearchParams

  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2">
        <Link to="/accueil" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E3E8F3]" aria-label="Retour à l’accueil"><FigmaIcon name="arrow-left" size={24} /></Link>
        <div><h1 className="text-[18px] font-bold">Tes trajets</h1><p className="text-[13px] text-[#5B6785]">{search.from || 'Départ'} → {search.to || 'Destination'}</p></div>
      </div>
      <div className="mt-3 flex-1 px-5 pb-4 pt-2">
        {!result.ok && (
          <div className="rounded-[20px] border border-[#FDE8EA] bg-[#FDE8EA] p-4" role="alert">
            <h2 className="font-bold text-[#D92D3A]">Recherche indisponible</h2>
            <p className="mt-1 text-[14px] text-[#0F1B3D]">{result.message}</p>
          </div>
        )}
        {result.ok && result.data.kind === 'no_verified_journey' && (
          <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-5" role="status">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8EFFF]"><FigmaIcon name="bus-stop" size={22} /></span>
            <h2 className="mt-3 text-[21px] font-bold">Aucun trajet vérifié trouvé</h2>
            <p className="mt-2 text-[14px] text-[#5B6785]">Cela ne veut pas dire qu’aucun bus ne passe. Nous n’avons simplement pas de trajet vérifié pour ces lieux.</p>
            <Link to="/accueil" className="mt-4 flex h-12 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Modifier ma recherche</Link>
          </div>
        )}
        {result.ok && result.data.kind === 'routes' && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">{result.data.routes.length} trajet{result.data.routes.length > 1 ? 's' : ''} vérifié{result.data.routes.length > 1 ? 's' : ''}</h2>
              <span className="rounded-full bg-[#E7F5ED] px-3 py-1 text-[13px] font-semibold text-[#12A150]">Données vérifiées</span>
            </div>
            {result.data.partial && (
              <p className="mb-3 rounded-xl bg-[#FFF1D6] p-3 text-[14px] text-[#B26A00]" role="status">
                Résultats limités : certains trajets ont pu être omis. {result.data.partialReason === 'deadline' ? 'La recherche a dépassé le délai prévu.' : result.data.partialReason === 'call_limit' ? 'La limite de calcul a été atteinte.' : 'Le service de marche est temporairement indisponible.'}
              </p>
            )}
            <div className="space-y-3">
              {result.data.routes.map((journey) => {
                const lineNames = [...new Map(journey.legs.map((leg) => [`${leg.network}:${leg.lineNumber}`, `${leg.networkName} ${leg.lineNumber}`])).values()]
                const stopCount = journey.legs.reduce((count, leg) => count + leg.orderedStops.length, 0)
                return (
                  <article key={journey.id} className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        {lineNames.map((line) => <span key={line} className="rounded-lg bg-[#1F5EFF] px-3 py-1.5 text-[16px] font-bold text-white">{line}</span>)}
                      </div>
                      <span className="rounded-full bg-[#E8EFFF] px-3 py-1 text-[13px] font-semibold text-[#0B3BCC]">{journey.transferCount === 0 ? 'Direct' : `${journey.transferCount} correspondance${journey.transferCount > 1 ? 's' : ''}`}</span>
                    </div>
                    <p className="mt-3 text-[18px] font-bold">Zone desservie : {journey.servedAreaName}</p>
                    <p className="mt-1 text-[14px] text-[#5B6785]">{stopCount} repères · {journey.totalWalkMeters} m de marche au total</p>
                    <div className="mt-3 space-y-3">
                      {journey.legs.map((leg, index) => (
                        <div key={`${journey.id}:${leg.directionId}`} className="rounded-xl bg-[#F6F8FB] p-3">
                          <p className="font-semibold">{leg.networkName} {leg.lineNumber} · direction {leg.directionName}</p>
                          <p className="mt-1 text-[14px] text-[#5B6785]">Monte à {leg.boardingStop.name} · descends à {leg.alightingStop.name}</p>
                          <p className="mt-1 text-[14px] text-[#5B6785]">{leg.orderedStops.length} repères vérifiés dans cette partie</p>
                          {index === journey.legs.length - 1 && <p className="mt-1 text-[14px] text-[#5B6785]">Destination cherchée : {journey.searchedDestination.displayName}</p>}
                          <p className="mt-1 text-[13px] font-medium text-[#0B3BCC]">Dis au receveur : « {leg.receiverQuestion} »</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[12px] text-[#5B6785]">Vérifié le {new Date(journey.verifiedAt).toLocaleDateString('fr-FR')}</p>
                    <Link
                      to="/parcours"
                      search={{ ...search, journey: journey.id } as never}
                      className="mt-3 flex h-12 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white"
                    >Voir le parcours détaillé</Link>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}
