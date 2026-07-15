'use client'

import { Sidebar } from './sidebar'
import { usePathname } from 'next/navigation'

// ─── Types ───────────────────────────────────────────────────
interface AppShellProps {
  children: React.ReactNode
}

// ─── Breadcrumb automatique ──────────────────────────────────
const pageTitles: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/documents': 'Documents',
  '/documents/upload': 'Upload de document',
  '/transactions': 'Transactions',
  '/exports': 'Exports comptables',
  '/settings': 'Paramètres',
}

function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length <= 1) return null

  return (
    <nav aria-label="Fil d'Ariane" className="mb-6">
      <ol className="flex items-center gap-2 text-sm text-gray-500">
        {segments.map((segment, index) => {
          const href = '/' + segments.slice(0, index + 1).join('/')
          const label = pageTitles[href] || segment.charAt(0).toUpperCase() + segment.slice(1)
          const isLast = index === segments.length - 1

          return (
            <li key={href} className="flex items-center gap-2">
              {index > 0 && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
              {isLast ? (
                <span className="text-gray-900 font-medium">{label}</span>
              ) : (
                <span className="hover:text-gray-700 cursor-default">{label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// ─── Composant AppShell ──────────────────────────────────────
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      {/* Zone de contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Espace pour le bouton hamburger sur mobile */}
            <div className="lg:hidden w-10" />
            
            <Breadcrumb />

            {/* Zone d'actions rapides (extensible plus tard) */}
            <div className="flex items-center gap-3">
              {/* Bouton upload rapide */}
              <a
                href="/documents/upload"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                Nouveau document
              </a>
            </div>
          </div>
        </header>

        {/* Contenu de la page */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="px-4 lg:px-8 py-4 border-t border-gray-200 bg-white">
          <p className="text-xs text-gray-400 text-center">
            © {new Date().getFullYear()} Paperasse AI · Pré-comptabilité intelligente
          </p>
        </footer>
      </div>
    </div>
  )
}