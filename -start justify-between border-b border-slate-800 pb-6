import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileText, Zap, Download, Clock, CheckCircle, Shield } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-xl font-bold">Paperasse.ai</div>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">
              Tarifs
            </Link>
            <Link href="/login">
              <Button variant="ghost">Connexion</Button>
            </Link>
            <Link href="/signup">
              <Button>Essai gratuit</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            La pré-compta automatique pour artisans du bâtiment
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Déposez vos factures, tickets et reçus. Paperasse.ai les analyse, les classe
            et prépare un export propre pour votre comptable.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Essayer gratuitement
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Voir comment ça marche
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Votre compta ne devrait pas vous prendre vos soirées
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              'Tickets perdus dans les poches',
              'Factures à trier en fin de mois',
              'TVA à vérifier manuellement',
              'Relances clients oubliées',
              'Documents envoyés trop tard au comptable',
              'Aucune visibilité sur vos dépenses',
            ].map((problem, i) => (
              <div key={i} className="flex items-center gap-3 text-gray-700">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                {problem}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Comment ça marche</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">1. Déposez vos documents</h3>
              <p className="text-gray-600">
                Ajoutez une facture PDF, une photo de ticket ou un reçu.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">2. L'IA analyse</h3>
              <p className="text-gray-600">
                Montants, TVA, fournisseur, date, catégorie : tout est extrait.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3. Exportez</h3>
              <p className="text-gray-600">
                Validez et générez un fichier prêt pour votre comptable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Ce que vous gagnez
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: Clock, text: 'Plusieurs heures gagnées par mois' },
              { icon: CheckCircle, text: 'Moins d\'oublis et d\'erreurs' },
              { icon: FileText, text: 'Documents toujours organisés' },
              { icon: Download, text: 'Export comptable en un clic' },
              { icon: Zap, text: 'TVA calculée automatiquement' },
              { icon: Shield, text: 'Justificatifs archivés proprement' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-lg">
                <Icon className="w-6 h-6 text-blue-600 flex-shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Prêt à simplifier votre paperasse ?
          </h2>
          <p className="text-gray-600 mb-8">
            Essayez gratuitement pendant 7 jours. Sans engagement.
          </p>
          <Link href="/signup">
            <Button size="lg">Commencer maintenant</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center text-gray-600 text-sm">
          © 2026 Paperasse.ai. Tous droits réservés.
        </div>
      </footer>
    </div>
  )
}
