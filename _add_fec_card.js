const fs = require('fs');
const path = 'app/(app)/exports/page.tsx';

if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');

  // Ajouter la carte d'export FEC si absente
  if (!content.includes('Générer le fichier FEC')) {
    const fecCard = `
      {/* Carte Export FEC Officiel */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-700 rounded-xl">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Fichier FEC Officiel (DGFiP / Expert-Comptable)</h3>
              <p className="text-xs text-gray-500">
                Fichier d'écritures comptables normé avec comptes du PCG (601, 401, 44566, 706). Requis pour Cegid, Sage, Pennylane.
              </p>
            </div>
          </div>
          <a href="/api/exports/fec" download>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Download className="h-4 w-4" />
              Télécharger le FEC (.txt)
            </Button>
          </a>
        </div>
      </div>
    `;

    content = content.replace(
      /{/\* Carte Export CSV \*/}|<div className="bg-white p-6 rounded-xl/g,
      fecCard + '\n\n<div className="bg-white p-6 rounded-xl'
    );

    fs.writeFileSync(path, content, 'utf8');
    console.log("✅ Carte Export FEC ajoutée à la page /exports !");
  }
}
