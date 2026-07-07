import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Paperasse.ai - Pré-compta automatique pour artisans',
  description:
    'Déposez vos factures, tickets et reçus. Paperasse.ai les classe automatiquement et prépare un export propre pour votre comptable.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
