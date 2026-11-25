import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'

export const Route = createFileRoute('/proposer')({ component: Proposer })

function Proposer() {
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/contribuer" aria-label="Retour à la contribution"><FigmaIcon name="arrow-left" size={24} /></Link><h1 className="text-[18px] font-bold">Proposer un parcours</h1></div>
      <div className="flex flex-1 flex-col justify-center px-6 py-10 text-center">
        <h2 className="text-[22px] font-bold">Cette fonction arrive bientôt</h2>
        <p className="mt-2 text-[15px] text-[#5B6785]">Il n’y a pas encore de formulaire relié au processus de vérification des trajets. Aucune proposition ne sera enregistrée depuis cette page.</p>
        <Link to="/accueil" className="mt-5 flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Chercher un trajet</Link>
      </div>
      <BottomNav active="contribuer" />
    </Phone>
  )
}
