import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { FigmaIcon, Phone, PrimaryButton } from '@/components/yoonu'
import { requestOtp, verifyOtp } from '@/server/yoonu'
import { useAction } from '@/lib/actions'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/connexion')({
  component: Connexion,
})

function Connexion() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const ask = useAction(
    async () => {
      const r = await requestOtp({ data: { email } })
      if ((r as { error?: string }).error) throw new Error((r as { error: string }).error)
      return r
    },
    { onSuccess: () => setStep('code') },
  )
  const check = useAction(
    async () => {
      const r = await verifyOtp({ data: { email, code } })
      if ((r as { error?: string }).error) throw new Error((r as { error: string }).error)
      // connecte un compte local pour le profil (email comme identifiant)
      try {
        localStorage.setItem('yb-user', email.toLowerCase())
      } catch { /* ignore */ }
      return r
    },
    { onSuccess: () => nav({ to: '/profil' as never }) },
  )

  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/contribuer" aria-label="Retour à la contribution"><FigmaIcon name="arrow-left" size={24} /></Link><h1 className="text-[17px] font-bold">Connexion pour contribuer</h1></div>
      <div className="px-6 pt-6">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8EFFF] text-2xl">👤</span>
        {step === 'email' ? (
          <>
            <h2 className="mt-4 text-[22px] font-bold">Reçois ton code en 1 minute</h2>
            <p className="mt-1 text-[14px] text-[#5B6785]">On t'envoie un code à 6 chiffres par email. Pas de mot de passe à retenir.</p>
            <label htmlFor="email" className="mt-4 block text-[13px] font-semibold">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="awa@exemple.sn" className="mt-1 w-full rounded-xl border border-[#E3E8F3] bg-white p-3 outline-none focus:border-[#1F5EFF]" />
            <div className="mt-4"><PrimaryButton onClick={() => ask.run()}> {ask.pending ? 'Envoi…' : 'Recevoir mon code'}</PrimaryButton></div>
            {ask.error && <p role="alert" className="mt-2 text-[13px] text-red-600">{String(ask.error)}</p>}
          </>
        ) : (
          <>
            <h2 className="mt-4 text-[22px] font-bold">Entre ton code à 6 chiffres</h2>
            <p className="mt-1 text-[14px] text-[#5B6785]">Envoyé à {email}. <button className="underline" onClick={() => setStep('email')}>Modifier</button></p>
            <label htmlFor="code" className="mt-4 block text-[13px] font-semibold">Code</label>
            <input id="code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="------" className="mt-1 w-full rounded-xl border border-[#E3E8F3] bg-white p-3 text-center text-[22px] font-bold tracking-[6px] outline-none focus:border-[#1F5EFF]" />
            <div className="mt-4"><PrimaryButton onClick={() => check.run()}> {check.pending ? 'Vérification…' : 'Valider'}</PrimaryButton></div>
            {check.error && <p role="alert" className="mt-2 text-[13px] text-red-600">{String(check.error)}</p>}
            <button onClick={() => ask.run()} className="mt-2 w-full text-[13px] text-[#0B3BCC] underline">Renvoyer le code</button>
          </>
        )}
        <p className="mt-4 text-center text-[12px] text-[#5B6785]">En te connectant, tu acceptes que tes infos vérifiées aident Dakar à mieux voyager.</p>
      </div>
    </Phone>
  )
}

export const _a = authClient
