const fs = require('fs');

// --- transactions/page.tsx : fetch robuste ---
const txPath = 'app/(app)/transactions/page.tsx';
if (fs.existsSync(txPath)) {
  let s = fs.readFileSync(txPath, 'utf8');

  // Remplacer le bloc de fetch typique par une version simple et logg?e
  // On cherche from('transactions') et on s'assure du select simple
  s = s.replace(
    /\.from\('profiles'\)\s*\.select\(['"][^'"]*['"]\)/g,
    ".from('profiles').select('organization_id')"
  );

  // select transactions SANS jointure fragile d'abord
  s = s.replace(
    /\.from\('transactions'\)\s*\.select\(['"][^'"]*['"]\)/g,
    ".from('transactions').select('*')"
  );

  // Si le code exige org et ?choue, ajouter fallback apr?s error - injection marqueur
  if (!s.includes('[TX-LOAD-V2]')) {
    s = s.replace(
      'setItems((data as TransactionItem[]) || [])',
      `console.log('[TX-LOAD-V2]', { org: profile?.organization_id, count: data?.length, data })
      setItems((data as TransactionItem[]) || [])`
    );
  }

  fs.writeFileSync(txPath, s, 'utf8');
  console.log('transactions page updated');
}

// --- validate route: v?rifier contenu newStatus ---
const vPath = 'app/api/documents/validate/route.ts';
if (fs.existsSync(vPath)) {
  const v = fs.readFileSync(vPath, 'utf8');
  if (v.includes("'analyzed'") && v.includes(': doc.status') && !v.includes("else if (doc.status === 'uploaded')")) {
    console.log('WARNING: validate route still looks broken');
  } else {
    console.log('validate route looks OK structurally');
  }
  // Show lines 85-100
  const lines = v.split(/\\r?\\n/);
  for (let i = 84; i < 100 && i < lines.length; i++) {
    console.log(String(i+1).padStart(4) + '| ' + lines[i]);
  }
}
