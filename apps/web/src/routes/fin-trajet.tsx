import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'

export const Route = createFileRoute('/fin-trajet')({ component: FinTrajet })

function FinTrajet() {
  return (
    <Phone>
      <div className="flex items-center gap-4 px-6 py-2"><Link to="/accueil" aria-label="Retour à l’accueil"><FigmaIcon name="arrow-left" size={24} /></Link><h1 className="text-[18px] font-bold">Fin de trajet</h1></div>
      <div className="flex flex-1 flex-col justify-center px-6 py-10 text-center">
        <h2 className="text-[22px] font-bold">Aucun suivi de trajet n’est en cours</h2>
        <p className="mt-2 text-[15px] text-[#5B6785]">L’application ne reçoit pas la position des bus et ne peut pas détecter une arrivée. Consulte les arrêts fournis par une recherche vérifiée.</p>
        <Link to="/accueil" className="mt-5 flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Chercher un trajet</Link>
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}
