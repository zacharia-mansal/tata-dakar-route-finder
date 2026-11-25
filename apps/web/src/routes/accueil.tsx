import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { PlaceCandidate } from '../../../../packages/domain/src/place'
import { BottomNav, FigmaIcon, Phone, PrimaryButton } from '@/components/yoonu'
import { selectionForPlace } from '@/lib/transit-api'
import { resolveTransitPlaces } from '@/server/transit'

type SupportedNetwork = 'aftu_dakar' | 'tata_thies'

export const Route = createFileRoute('/accueil')({
  validateSearch: (search: Record<string, unknown>): { network?: SupportedNetwork } =>
    search.network === 'tata_thies' ? { network: 'tata_thies' } : {},
  component: Accueil,
})

type SearchField = 'origin' | 'destination'

function Accueil() {
  const navigate = useNavigate()
  const routeSearch = Route.useSearch()
  const [network, setNetwork] = useState<SupportedNetwork>(routeSearch.network ?? 'aftu_dakar')
  const [originText, setOriginText] = useState('')
  const [destinationText, setDestinationText] = useState('')
  const [origin, setOrigin] = useState<PlaceCandidate | null>(null)
  const [destination, setDestination] = useState<PlaceCandidate | null>(null)
  const [activeField, setActiveField] = useState<SearchField | null>(null)
  const [places, setPlaces] = useState<PlaceCandidate[]>([])
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const [placeMessage, setPlaceMessage] = useState('')

  const activeText = activeField === 'origin' ? originText : destinationText

  useEffect(() => setNetwork(routeSearch.network ?? 'aftu_dakar'), [routeSearch.network])

  useEffect(() => {
    let current = true
    const query = activeText.trim()
    if (!activeField || query.length < 2) {
      setPlaces([])
      setLoadingPlaces(false)
      setPlaceMessage('')
      return
    }

    setLoadingPlaces(true)
    setPlaceMessage('')
    const timer = setTimeout(async () => {
      try {
        const result = await resolveTransitPlaces({ data: { query, locale: 'fr' } })
        if (!current) return
        if (!result.ok) {
          setPlaces([])
          setPlaceMessage(result.message)
        } else if (result.data.places.length === 0) {
          setPlaces([])
          setPlaceMessage('Aucun lieu trouvé. Essaie un autre nom.')
        } else {
          setPlaces(result.data.places)
        }
      } catch {
        if (current) {
          setPlaces([])
          setPlaceMessage('La recherche de lieux est temporairement indisponible.')
        }
      } finally {
        if (current) setLoadingPlaces(false)
      }
    }, 250)

    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [activeField, activeText])

  const editField = (field: SearchField, value: string) => {
    setActiveField(field)
    if (field === 'origin') {
      setOriginText(value)
      setOrigin(null)
    } else {
      setDestinationText(value)
      setDestination(null)
    }
  }

  const choosePlace = (place: PlaceCandidate) => {
    if (activeField === 'origin') {
      setOrigin(place)
      setOriginText(place.displayName)
    } else {
      setDestination(place)
      setDestinationText(place.displayName)
    }
    setPlaces([])
    setPlaceMessage('')
    setActiveField(null)
  }

  const swap = () => {
    setOriginText(destinationText)
    setDestinationText(originText)
    setOrigin(destination)
    setDestination(origin)
    setActiveField(null)
    setPlaces([])
  }

  const startSearch = () => {
    if (!origin || !destination) return
    void navigate({
      to: '/itineraire' as never,
      search: {
        origin: JSON.stringify(selectionForPlace(origin)),
        destination: JSON.stringify(selectionForPlace(destination)),
        network,
        from: origin.displayName,
        to: destination.displayName,
      } as never,
    })
  }

  return (
    <Phone>
      <div className="rounded-b-[24px] bg-[#1F5EFF] px-5 pb-6 pt-2">
        <div className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[13px] font-bold"><FigmaIcon name="map-pin" size={16} /> yoonubus</div>
        <h1 className="mt-3 text-[22px] font-bold text-white">Bonjour</h1>
        <p className="text-white/90">Où veux-tu aller ?</p>
      </div>
      <div className="-mt-3 flex-1 rounded-t-[24px] bg-[#F6F8FB] px-5 pt-5">
        <label htmlFor="network" className="text-[13px] font-bold">RÉSEAU DE BUS</label>
        <select
          id="network"
          value={network}
          onChange={(event) => setNetwork(event.target.value as SupportedNetwork)}
          className="mt-1 mb-3 min-h-12 w-full rounded-xl border border-[#E3E8F3] bg-white px-3 text-[15px] font-medium"
          aria-label="Réseau de bus"
        >
          <option value="aftu_dakar">AFTU Dakar</option>
          <option value="tata_thies">Tata Thiès</option>
        </select>
        <label htmlFor="origin" className="text-[13px] font-bold">DÉPART</label>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#E3E8F3] bg-white px-3 py-3">
          <FigmaIcon name="dot" size={10} />
          <input
            id="origin"
            value={originText}
            onFocus={() => setActiveField('origin')}
            onChange={(event) => editField('origin', event.target.value)}
            placeholder="Saisis ton départ"
            className="w-full bg-transparent font-medium outline-none placeholder:text-[#5B6785]"
            aria-label="Départ"
            autoComplete="off"
          />
          {origin && <span aria-label="Départ choisi" className="text-[13px] font-semibold text-[#12A150]">Choisi</span>}
        </div>
        <div className="my-1 flex justify-center">
          <button onClick={swap} className="flex h-10 items-center justify-center rounded-xl bg-[#F5A623] px-3 text-[13px] font-semibold text-white" aria-label="Inverser départ et destination">Inverser</button>
        </div>
        <label htmlFor="destination" className="text-[13px] font-bold">DESTINATION</label>
        <div className="mt-1 flex items-center gap-2 rounded-xl border-2 border-[#1F5EFF] bg-[#E8EFFF] px-3 py-3">
          <FigmaIcon name="bookmark" size={20} />
          <input
            id="destination"
            value={destinationText}
            onFocus={() => setActiveField('destination')}
            onChange={(event) => editField('destination', event.target.value)}
            placeholder="Saisis un lieu ou une zone"
            className="w-full bg-transparent font-medium outline-none placeholder:text-[#5B6785]"
            aria-label="Destination"
            autoComplete="off"
          />
          {destination && <span aria-label="Destination choisie" className="text-[13px] font-semibold text-[#12A150]">Choisie</span>}
        </div>

        {activeField && activeText.trim().length >= 2 && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-[#E3E8F3] bg-white" role="listbox" aria-label="Lieux proposés">
            <p className="bg-[#FFF8EC] px-4 py-2 text-[13px] font-medium">Choisis le lieu qui correspond à ta recherche.</p>
            {loadingPlaces && <p className="px-4 py-3 text-[14px] text-[#5B6785]" role="status">Recherche des lieux…</p>}
            {places.map((place) => (
              <button
                key={`${place.source}:${place.id}`}
                onClick={() => choosePlace(place)}
                className="flex min-h-14 w-full items-center gap-3 border-t border-[#E3E8F3] px-4 py-3 text-left hover:bg-[#F6F8FB]"
                role="option"
                aria-selected={false}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8EFFF]"><FigmaIcon name="location" size={24} /></span>
                <span className="flex-1"><span className="block font-semibold">{place.displayName}</span><span className="block text-[13px] text-[#5B6785]">{place.areaName} · {place.source === 'catalogue' ? 'lieu vérifié du catalogue' : 'lieu trouvé sur la carte'}</span></span>
                <FigmaIcon name="chevron-right" size={18} />
              </button>
            ))}
            {!loadingPlaces && placeMessage && <p className="px-4 py-3 text-[14px] text-[#5B6785]" role="status">{placeMessage}</p>}
          </div>
        )}

        <div className="mt-4">
          <PrimaryButton onClick={startSearch} className={!origin || !destination ? 'cursor-not-allowed opacity-60' : ''}>
            Rechercher un trajet
          </PrimaryButton>
          <p className="mt-2 text-center text-[13px] text-[#5B6785]">Choisis un départ et une destination dans les résultats.</p>
        </div>
        <div className="mt-5 rounded-2xl border border-[#E3E8F3] bg-white p-4">
          <p className="font-semibold text-[#0F1B3D]">Les trajets affichés sont vérifiés</p>
          <p className="mt-1 text-[14px] text-[#5B6785]">Une recherche sans résultat ne veut pas dire qu’aucun bus ne passe. Elle signifie qu’aucun trajet vérifié n’a été trouvé pour ces lieux.</p>
        </div>
        <div className="h-5" />
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}
