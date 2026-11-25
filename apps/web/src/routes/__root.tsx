import type { ReactNode } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { seoHead } from '@/lib/monstarx/seo'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: (ctx) => {
    const seo = seoHead(ctx)
    return {
      ...seo,
      links: [
        ...seo.links,
        { rel: 'stylesheet', href: appCss },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap' },
      ],
    }
  },
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-[#E9EDF3] text-[#0F1B3D] antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  return <Outlet />
}

function NotFound() {
  return (
    <main className="yb-phone flex min-h-screen items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">Page introuvable</h1>
        <p className="mt-2 text-[#5B6785]">La page demandée n'existe pas.</p>
        <a href="/accueil" className="mt-4 inline-block rounded-full bg-[#1F5EFF] px-6 py-3 font-semibold text-white">Retour à l'accueil</a>
      </div>
    </main>
  )
}
