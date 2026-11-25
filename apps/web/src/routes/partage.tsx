import { createFileRoute, Link } from '@tanstack/react-router'
import { FigmaIcon, Phone } from '@/components/yoonu'

export const Route = createFileRoute('/partage')({ component: Partage })

function Partage() {
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/accueil" aria-label="Retour à l’accueil"><FigmaIcon name="arrow-left" size={24} /></Link><h1 className="text-[17px] font-bold">Partager un trajet</h1></div>
      <div className="flex flex-1 flex-col justify-center px-6 py-10 text-center">
        <h2 className="text-[22px] font-bold">Ouvre d’abord un résultat de recherche</h2>
        <p className="mt-2 text-[15px] text-[#5B6785]">Nous ne préparons pas de message de partage avec des informations d’exemple. Le partage sera disponible depuis un trajet réellement retourné par le service.</p>
        <Link to="/accueil" className="mt-5 flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Chercher un trajet</Link>
      </div>
    </Phone>
  )
}
