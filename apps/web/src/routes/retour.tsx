import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { BottomNav, Phone } from '@/components/yoonu'
import { submitContribution } from '@/server/yoonu'
import { useAction } from '@/lib/actions'

export const Route = createFileRoute('/retour')({
  component: Retour,
})

function OuiNon({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={value === true}
        className={`flex h-14 flex-1 items-center justify-center gap-1 rounded-full border px-4 text-[16px] font-semibold ${
          value === true
            ? 'border-[#12A150] bg-[#E7F5ED] text-[#12A150]'
            : 'border-[#E3E8F3] bg-white text-[#0F1B3D]'
        }`}
      >
        Oui {value === true && '✓'}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={value === false}
        className={`flex h-14 flex-1 items-center justify-center rounded-full border px-4 text-[16px] font-semibold ${
          value === false
            ? 'border-[#1F5EFF] bg-[#E8EFFF] text-[#1F5EFF]'
            : 'border-[#E3E8F3] bg-white text-[#0F1B3D]'
        }`}
      >
        Non
      </button>
    </div>
  )
}

function Retour() {
  const navigate = useNavigate()
  const [ligneOk, setLigneOk] = useState<boolean | null>(true)
  const [arretOk, setArretOk] = useState<boolean | null>(true)
  const [depart, setDepart] = useState('')
  const save = useAction(
    async () => {
      const msg = `Retour trajet Tata 24: ligne=${ligneOk ? 'oui' : 'non'}, arret=${arretOk ? 'oui' : 'non'}, depart=${depart || 'Castor'}`
      return await submitContribution({
        data: { name: 'Retour trajet Tata 24', type: 'retour-trajet', lineName: 'Tata 24', message: msg },
      })
    },
    { onSuccess: () => navigate({ to: '/fin-trajet' as never }) },
  )

  return (
    <Phone>
      <div className="flex items-center gap-3 px-4 py-2">
        <Link to="/fin-trajet" className="flex h-12 w-12 items-center justify-center text-[22px] text-[#0F1B3D]">←</Link>
        <h1 className="text-[16px] font-semibold text-[#0F1B3D]">Retour sur le trajet</h1>
      </div>
      <div className="flex h-[6px]">
        <div className="w-1/3 bg-[#F5C518]" />
        <div className="w-1/3 bg-[#1F5EFF]" />
        <div className="w-1/3 bg-[#12A150]" />
      </div>
      <div className="flex flex-col gap-5 px-6 pb-4 pt-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5C518] text-[22px]">🚌</span>
            <h2 className="text-[22px] font-bold leading-[33px] tracking-[-0.5px] text-[#0F1B3D]">
              Comment s&apos;est passé le trajet&nbsp;?
            </h2>
          </div>
          <p className="mt-2 text-[14px] text-[#5B6785]">Ton retour aide toute la communauté yoonubus 🙏</p>
        </div>
        <div className="flex flex-col gap-2 rounded-[20px] border border-[#E3E8F3] bg-[#E8EFFF] p-5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#F5C518] px-3 py-1 text-[12px] font-bold text-[#0F1B3D]">24</span>
            <p className="text-[16px] font-semibold text-[#0F1B3D]">Tata 24 · direction Université</p>
          </div>
          <p className="text-[14px] font-medium text-[#5B6785]">Castor → Université → ISM Dakar</p>
        </div>
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-[16px] font-semibold text-[#0F1B3D]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1F5EFF] text-[12px] font-bold text-white">1</span>
            La ligne et le sens étaient corrects&nbsp;?
          </p>
          <OuiNon value={ligneOk} onChange={setLigneOk} />
        </div>
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-[16px] font-semibold text-[#0F1B3D]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1F5EFF] text-[12px] font-bold text-white">2</span>
            Le bon arrêt pour ta destination&nbsp;?
          </p>
          <OuiNon value={arretOk} onChange={setArretOk} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="retour-depart" className="text-[14px] font-medium text-[#0F1B3D]">
            Départ
          </label>
          <input
            id="retour-depart"
            value={depart}
            onChange={(e) => setDepart(e.target.value)}
            placeholder="Saisir le départ"
            className="h-14 rounded-[12px] border border-[#E3E8F3] bg-white px-3 text-[16px] text-[#0F1B3D] placeholder:text-[#0F1B3D]"
          />
        </div>
        <Link
          to="/suivi"
          search={{ etat: 'signaler' } as never}
          className="flex h-14 w-full items-center justify-center rounded-full border border-[#1F5EFF] bg-white px-6 text-[16px] font-semibold text-[#0B3BCC]"
        >
          Signaler une information incorrecte
        </Link>
        <div className="flex gap-3 rounded-[16px] border border-[#F5C518] bg-[#FFFBEA] p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5C518]">💛</span>
          <p className="text-[14px] font-medium text-[#0F1B3D]">
            Ton avis sera vérifié avant toute modification. Merci pour ta contribution&nbsp;!
          </p>
        </div>
        {save.error && (
          <p role="alert" className="text-center text-[14px] font-medium text-red-600">
            {String(save.error)}
          </p>
        )}
        <button
          type="button"
          onClick={() => save.run()}
          disabled={save.pending || ligneOk === null || arretOk === null}
          className="flex h-14 w-full items-center justify-center rounded-full bg-[#1F5EFF] px-6 text-[16px] font-semibold text-white disabled:opacity-60"
        >
          {save.pending ? 'Envoi…' : 'Envoyer mon avis 🚌'}
        </button>
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}
