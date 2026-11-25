import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'

export const Route = createFileRoute('/notifications')({ component: Notifications })

function Notifications() {
  return (
    <Phone>
      <div className="flex items-center gap-4 px-6 py-2"><Link to="/reglages" aria-label="Retour aux réglages"><FigmaIcon name="arrow-left" size={24} /></Link><h1 className="text-[20px] font-bold">Notifications</h1></div>
      <div className="flex flex-1 flex-col justify-center px-6 py-10 text-center">
        <h2 className="mt-4 text-[22px] font-bold">Les alertes de trajet ne sont pas disponibles</h2>
        <p className="mt-2 text-[15px] text-[#5B6785]">Cette version ne suit pas les bus et n’envoie pas d’alerte de descente. Les préférences ci-dessous ne changeraient pas le fonctionnement du service, donc elles ne sont pas activées.</p>
        <Link to="/accueil" className="mt-5 flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Chercher un trajet</Link>
      </div>
      <BottomNav active="profil" />
    </Phone>
  )
}
