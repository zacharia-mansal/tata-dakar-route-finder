import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'

export const Route = createFileRoute('/suivi')({ component: Suivi })

function Suivi() {
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2">
        <Link to="/accueil" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E3E8F3]" aria-label="Retour à l’accueil"><FigmaIcon name="arrow-left" size={24} /></Link>
        <h1 className="text-[18px] font-bold">Suivi du bus</h1>
      </div>
      <div className="flex flex-1 flex-col justify-center px-6 py-10 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E8EFFF]"><FigmaIcon name="map-pin" size={24} /></span>
        <h2 className="mt-4 text-[22px] font-bold">Le suivi en direct n’est pas disponible</h2>
        <p className="mt-2 text-[15px] text-[#5B6785]">Nous ne recevons pas la position GPS des bus. Tu peux consulter les arrêts connus et les repères du trajet, mais l’application ne peut pas annoncer la position du bus ni l’heure d’arrivée.</p>
        <Link to="/accueil" className="mt-5 flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Chercher un trajet</Link>
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}
