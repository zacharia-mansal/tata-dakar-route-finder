import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'

export const Route = createFileRoute('/retour')({ component: Retour })

function Retour() {
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/accueil" aria-label="Retour à l’accueil"><FigmaIcon name="arrow-left" size={24} /></Link><h1 className="text-[18px] font-bold">Donner un retour</h1></div>
      <div className="flex flex-1 flex-col justify-center px-6 py-10 text-center">
        <h2 className="text-[22px] font-bold">Les retours de trajet ne sont pas encore ouverts</h2>
        <p className="mt-2 text-[15px] text-[#5B6785]">Nous activerons cette page lorsque les retours seront reliés à un processus de vérification. Rien n’est envoyé depuis cette version.</p>
        <Link to="/accueil" className="mt-5 flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Retour à la recherche</Link>
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}
