import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'

type SupportedNetwork = 'aftu_dakar' | 'tata_thies'

export const Route = createFileRoute('/ligne')({
  validateSearch: (search: Record<string, unknown>) => ({
    network: search.network === 'tata_thies' ? 'tata_thies' as const : 'aftu_dakar' as const,
  }),
  component: Ligne,
})

function Ligne() {
  const routeSearch = Route.useSearch()
  const [network, setNetwork] = useState<SupportedNetwork>(routeSearch.network)

  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2">
        <Link to="/accueil" search={{ network } as never} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E3E8F3]" aria-label="Retour à l’accueil"><FigmaIcon name="arrow-left" size={24} /></Link>
        <h1 className="text-[18px] font-bold">Détail d’une ligne</h1>
      </div>
      <div className="px-6 pt-4 text-left">
        <label htmlFor="line-network" className="text-[13px] font-bold">RÉSEAU DE LA LIGNE</label>
        <select id="line-network" value={network} onChange={(event) => {
          setNetwork(event.target.value as SupportedNetwork)
        }} className="mt-1 min-h-12 w-full rounded-xl border border-[#E3E8F3] bg-white px-3 text-[15px]">
          <option value="aftu_dakar">AFTU Dakar</option>
          <option value="tata_thies">Tata Thiès</option>
        </select>
      </div>
      <div className="flex flex-1 flex-col justify-center px-6 py-10 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E8EFFF]"><FigmaIcon name="bus-stop" size={22} /></span>
        <h2 className="mt-4 text-[22px] font-bold">Choisis un trajet pour voir ses arrêts</h2>
        <p className="mt-2 text-[15px] text-[#5B6785]">Réseau sélectionné : {network === 'aftu_dakar' ? 'AFTU Dakar' : 'Tata Thiès'}. Cette page ne contient pas encore de catalogue de lignes. Les résultats de recherche restent limités aux trajets vérifiés de ce réseau.</p>
        <Link to="/accueil" search={{ network } as never} className="mt-5 flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Chercher une ligne</Link>
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}
