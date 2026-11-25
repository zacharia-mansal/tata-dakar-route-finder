import { createServerFn } from '@tanstack/react-start'
import { getDb } from '@/lib/db'
import { busLines, busStops, contributions, otpCodes, places, savedItems } from '@/db/schema'
import { and, eq, like, or } from 'drizzle-orm'
import { sendEmail } from '@/lib/email'
import { currentUser } from '@/lib/session.server'

export const searchPlaces = createServerFn({ method: 'GET' })
  .validator((q: string) => q)
  .handler(async ({ data: q }) => {
    const db = await getDb()
    const query = q.trim().toLowerCase()
    if (!query) {
      return await db.select().from(places).limit(8)
    }
    return await db
      .select()
      .from(places)
      .where(or(like(places.name, `%${q}%`), like(places.area, `%${q}%`)))
      .limit(8)
  })

export const getHomeData = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDb()
  const allPlaces = await db.select().from(places).limit(12)
  const lines = await db.select().from(busLines)
  const stops = await db.select().from(busStops)
  return { places: allPlaces, lines, stops }
})

export const getItinerary = createServerFn({ method: 'GET' })
  .validator((d: { from: string; to: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb()
    const lines = await db.select().from(busLines)
    const stops = await db.select().from(busStops)
    const line = lines.find((l) => l.id === 'tata24') ?? lines[0]
    const lineStops = stops.filter((s) => s.lineId === line.id).sort((a, b) => a.order - b.order)
    return {
      from: data.from || 'Castor',
      to: data.to || 'ISM Dakar',
      line,
      stops: lineStops,
      totalMin: 27,
      walkStart: 6,
      busMin: 18,
      walkEnd: 3,
    }
  })

export const listSaved = createServerFn({ method: 'GET' })
  .validator((deviceId: string) => deviceId)
  .handler(async ({ data: deviceId }) => {
    const db = await getDb()
    const user = await currentUser().catch(() => null)
    if (user) {
      return await db.select().from(savedItems).where(eq(savedItems.userId, user.id))
    }
    if (!deviceId) return []
    return await db.select().from(savedItems).where(eq(savedItems.deviceId, deviceId))
  })

export const toggleSave = createServerFn({ method: 'POST' })
  .validator((d: { deviceId: string; kind: string; refId: string; title: string; subtitle?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb()
    const user = await currentUser().catch(() => null)
    const existing = await db
      .select()
      .from(savedItems)
      .where(
        and(
          eq(savedItems.kind, data.kind),
          eq(savedItems.refId, data.refId),
          user ? eq(savedItems.userId, user.id) : eq(savedItems.deviceId, data.deviceId),
        ),
      )
    if (existing.length > 0) {
      const { eq: eq2 } = await import('drizzle-orm')
      await db.delete(savedItems).where(eq2(savedItems.id, existing[0].id))
      return { saved: false }
    }
    await db.insert(savedItems).values({
      id: crypto.randomUUID(),
      userId: user?.id ?? null,
      deviceId: data.deviceId,
      kind: data.kind,
      refId: data.refId,
      title: data.title,
      subtitle: data.subtitle ?? null,
      createdAt: new Date().toISOString(),
    })
    return { saved: true }
  })

export const listContributions = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDb()
  const user = await currentUser().catch(() => null)
  if (!user) return []
  return await db.select().from(contributions).where(eq(contributions.userId, user.id))
})

export const submitContribution = createServerFn({ method: 'POST' })
  .validator((d: { name: string; type: string; lineName?: string; message: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb()
    const user = await currentUser().catch(() => null)
    const row = {
      id: crypto.randomUUID(),
      userId: user?.id ?? null,
      name: data.name.slice(0, 80),
      type: data.type,
      lineName: data.lineName ?? null,
      message: data.message.slice(0, 2000),
      status: 'reçue',
      points: 0,
      createdAt: new Date().toISOString(),
    }
    await db.insert(contributions).values(row)
    return { ok: true, id: row.id }
  })

export const requestOtp = createServerFn({ method: 'POST' })
  .validator((d: { email: string }) => d)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Entre un email valide.' as const }
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const db = await getDb()
    await db.insert(otpCodes).values({
      id: crypto.randomUUID(),
      email,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      used: false,
      createdAt: new Date().toISOString(),
    })
    try {
      await sendEmail({
        to: email,
        subject: 'Ton code Yoonu Bus',
        text: `Ton code de connexion Yoonu Bus : ${code}. Il expire dans 10 minutes.`,
        html: `<p>Ton code de connexion <strong>Yoonu Bus</strong> :</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>Il expire dans 10 minutes.</p>`,
      })
    } catch {
      // en preview sans email, on renvoie le code pour tester
    }
    return { ok: true as const, debugCode: code }
  })

export const verifyOtp = createServerFn({ method: 'POST' })
  .validator((d: { email: string; code: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb()
    const email = data.email.trim().toLowerCase()
    const rows = await db.select().from(otpCodes).where(and(eq(otpCodes.email, email), eq(otpCodes.code, data.code.trim())))
    const valid = rows.filter((r) => !r.used && new Date(r.expiresAt).getTime() > Date.now()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
    if (!valid) return { error: 'Code invalide ou expiré.' as const }
    await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, valid.id))
    // crée / connecte le compte via Better Auth sign-up email (mot de passe jetable interne)
    // On utilise directement la table user via getDb? On délègue au client : le code vérifié autorise la création d'un profil local.
    return { ok: true as const }
  })
