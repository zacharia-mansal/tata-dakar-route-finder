import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'

export const Route = createFileRoute('/info')({ component: Info })

function Info() {
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/accueil" aria-label="Retour à l’accueil"><FigmaIcon name="arrow-left" size={24} /></Link><h1 className="text-[17px] font-bold">À propos des informations</h1></div>
      <div className="space-y-3 px-5 py-4">
        <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <h2 className="font-bold">D’où viennent les trajets ?</h2>
          <p className="mt-2 text-[14px] text-[#5B6785]">Les résultats de recherche sont fournis par le service de trajets Yoonu Bus. Un résultat n’est affiché que si le service le retourne comme vérifié. La date affichée vient de sa réponse.</p>
        </div>
        <div className="rounded-[20px] border border-[#FFF1D6] bg-[#FFF1D6] p-4 text-[14px] text-[#0F1B3D]">
          Un trajet dessiné entre des arrêts est un repère indicatif, pas la route exacte du bus. Cette application ne localise pas les bus en temps réel.
        </div>
        <Link to="/accueil" className="flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Chercher un trajet</Link>
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}
