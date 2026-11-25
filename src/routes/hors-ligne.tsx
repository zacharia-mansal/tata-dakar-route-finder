import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, Phone, PrimaryButton, SecondaryButton } from '@/components/yoonu'

export const Route = createFileRoute('/hors-ligne')({
  validateSearch: (s: Record<string, unknown>) => ({
    vide: typeof s.vide === 'string' ? s.vide : undefined,
  }),
  component: HorsLigne,
})

function HorsLigne() {
  const search = Route.useSearch() as { vide?: string }
  const vide = search.vide === 'oui'

  return (
    <Phone>
      <div className="flex items-center gap-4 px-6 py-2">
        <Link to="/enregistres" className="text-[20px] text-[#0F1B3D]">←</Link>
        <h1 className="text-[20px] font-bold text-[#0F1B3D]">Mode hors ligne</h1>
      </div>
      <div className="bg-[#1F5EFF] px-6 py-6" style={{ background: 'linear-gradient(180deg,#1F5EFF,#0B3BCC)' }}>
        <span className="inline-block rounded-full bg-[#F5C518] px-4 py-1 text-[14px] font-bold text-[#0F1B3D]">
          Hors ligne
        </span>
        <h2 className="mt-3 text-[26px] font-bold leading-tight text-white">
          {vide ? 'On se retrouve dès le retour du réseau' : 'Pas de réseau ? On reste avec toi'}
        </h2>
        <p className="mt-2 text-[16px] text-white/90">
          {vide
            ? 'Aucun trajet n’a encore été téléchargé sur ce téléphone.'
            : 'Tes repères téléchargés sont disponibles sur ce téléphone.'}
        </p>
      </div>
      {vide ? (
        <div className="flex flex-col gap-5 p-6">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#E8EFFF] text-[36px]">⬇</span>
          <h3 className="text-[24px] font-bold text-[#0F1B3D]">Pas encore de données hors ligne</h3>
          <p className="text-[15px] text-[#5B6785]">
            Sans connexion et sans téléchargement, la recherche de trajet et les pages Ligne et Arrêt ne sont pas
            disponibles.
          </p>
          <PrimaryButton onClick={() => window.location.reload()}>Réessayer la connexion</PrimaryButton>
          <div className="rounded-[20px] border border-[#F5C518] bg-[#FFFBEA] p-4">
            <p className="font-bold text-[#0F1B3D]">◼ Pour ton prochain trajet</p>
            <p className="mt-2 text-[15px] text-[#5B6785]">
              Quand le réseau revient, cherche ton trajet puis choisis « Enregistrer pour hors-ligne ». Tu garderas le
              tracé et les arrêts avec toi.
            </p>
          </div>
          <p className="text-[14px] text-[#5B6785]">Stockage utilisé : 0 Mo · aucune synchronisation disponible.</p>
          <Link to="/hors-ligne" search={{ vide: undefined } as never} className="text-center text-[13px] font-semibold text-[#0B3BCC]">
            Voir l&apos;état « données enregistrées » →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4 bg-[#F6F8FB] p-6">
          <div className="rounded-[20px] border border-[#F5C518] bg-[#FFFBEA] p-4">
            <p className="text-[17px] font-bold text-[#0F1B3D]">Informations non actualisées</p>
            <p className="mt-2 text-[15px] text-[#5B6785]">
              Les passages estimés et les nouveaux signalements ne sont pas disponibles hors ligne.
            </p>
            <p className="mt-2 text-[14px] text-[#5B6785]">Dernière synchronisation : aujourd&apos;hui à 08:30.</p>
          </div>
          <span className="w-fit rounded-full bg-[#E7F5ED] px-3 py-1 text-[14px] font-semibold text-[#12A150]">
            Disponible hors ligne
          </span>
          <p className="text-[18px] font-bold text-[#0F1B3D]">Tes données enregistrées · 12,4 Mo</p>
          <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8EFFF] text-[24px]">🚌</span>
              <div className="flex-1">
                <p className="text-[17px] font-bold text-[#0F1B3D]">Castor → ISM Dakar</p>
                <p className="text-[14px] text-[#5B6785]">Tata 24 · descente à Université</p>
              </div>
              <span className="text-[20px]">›</span>
            </div>
            <p className="mt-2 text-[14px] text-[#5B6785]">6 min à pied · ~18 min en bus · 8 arrêts · 3 min à pied à l&apos;arrivée</p>
            <Link
              to="/parcours"
              search={{ from: 'Castor', to: 'ISM Dakar' } as never}
              className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-[#1F5EFF] px-6 text-[16px] font-semibold text-white"
            >
              Ouvrir le trajet enregistré
            </Link>
          </div>
          <Link to="/ligne" className="flex items-center gap-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4 text-[#0F1B3D]">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8EFFF] text-[24px]">🚏</span>
            <span className="flex-1">
              <span className="block text-[17px] font-bold text-[#0F1B3D]">Ligne Tata 24</span>
              <span className="block text-[14px] text-[#5B6785]">Castor – Université · tracé et arrêts</span>
              <span className="mt-2 inline-block rounded-full bg-[#E3E8F3] px-3 py-1 text-[12px] text-[#5B6785]">Vérifié</span>
            </span>
            <span className="text-[20px]">›</span>
          </Link>
          <Link to="/arret" className="flex items-center gap-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4 text-[#0F1B3D]">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8EFFF] text-[24px]">📍</span>
            <span className="flex-1">
              <span className="block text-[17px] font-bold text-[#0F1B3D]">Arrêt Université</span>
              <span className="block text-[14px] text-[#5B6785]">Repères de l&apos;arrêt et ligne enregistrée</span>
            </span>
            <span className="text-[20px]">›</span>
          </Link>
          <p className="text-[14px] text-[#5B6785]">
            Les durées enregistrées restent indicatives. Demande confirmation au receveur.
          </p>
          <SecondaryButton onClick={() => window.location.reload()}>Réessayer la connexion</SecondaryButton>
          <p className="text-[14px] text-[#5B6785]">Les données pourront être actualisées au retour du réseau.</p>
          <Link to="/hors-ligne" search={{ vide: 'oui' } as never} className="text-center text-[13px] font-semibold text-[#5B6785]">
            Voir l&apos;état « sans téléchargement » →
          </Link>
        </div>
      )}
      <BottomNav active="enregistres" />
    </Phone>
  )
}
