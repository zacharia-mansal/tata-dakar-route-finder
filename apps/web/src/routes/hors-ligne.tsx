import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'

export const Route = createFileRoute('/hors-ligne')({ component: HorsLigne })

function HorsLigne() {
  return (
    <Phone>
      <div className="flex items-center gap-4 px-6 py-2">
        <Link to="/enregistres" className="flex h-10 w-10 items-center justify-center text-[#0F1B3D]" aria-label="Retour aux éléments enregistrés"><FigmaIcon name="arrow-left" size={24} /></Link>
        <h1 className="text-[20px] font-bold text-[#0F1B3D]">Mode hors ligne</h1>
      </div>
      <div className="flex flex-1 flex-col justify-center px-6 py-10 text-center">
        <h2 className="mt-4 text-[22px] font-bold">La consultation hors ligne n’est pas encore disponible</h2>
        <p className="mt-2 text-[15px] text-[#5B6785]">Les éléments enregistrés sont conservés dans ton compte, mais cette version ne télécharge pas les parcours sur l’appareil. Il faut une connexion pour consulter les résultats.</p>
        <Link to="/enregistres" className="mt-5 flex h-14 items-center justify-center rounded-full border border-[#1F5EFF] font-semibold text-[#0B3BCC]">Voir mes éléments enregistrés</Link>
        <Link to="/accueil" className="mt-3 flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Chercher un trajet</Link>
      </div>
      <BottomNav active="enregistres" />
    </Phone>
  )
}
