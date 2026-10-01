const fs = require('fs');
const path = require('path');

function walk(dir, out) {
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      walk(p, out);
    } else if (/\.(tsx|ts|jsx|js)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function repair(s) {
  let out = s;

  // Cas exact vus dans les logs
  out = out.split("${loading  'animate-spin' : ''}").join("${loading ? 'animate-spin' : ''}");
  out = out.split('${loading  "animate-spin" : ""}').join('${loading ? "animate-spin" : ""}');
  out = out.split('budget > 0  budget - expense : null').join('budget > 0 ? budget - expense : null');
  out = out.split("income - expense >= 0  'text-blue-600' : 'text-red-600'").join("income - expense >= 0 ? 'text-blue-600' : 'text-red-600'");
  out = out.split("income - expense >= 0  'text-blue-600'").join("income - expense >= 0 ? 'text-blue-600'");
  out = out.split("value === undefined  '' :").join("value === undefined ? '' :");
  out = out.split("value === undefined  ''").join("value === undefined ? ''");
  out = out.split("setError('Le nom de l'entreprise est obligatoire')").join('setError("Le nom de l\'entreprise est obligatoire")');

  // isLast  (  -> isLast ? (
  out = out.split('isLast  (').join('isLast ? (');
  out = out.split('isLast (').join('isLast ? (');
  out = out.split('isLast ? ? (').join('isLast ? (');

  // instanceof Error   err.message
  out = out.replace(/instanceof Error[ \t]*\r?\n([ \t]*)err\.message/g, 'instanceof Error\n$1? err.message');
  out = out.replace(/instanceof Error[ \t]+err\.message/g, 'instanceof Error ? err.message');

  // Pattern general:  mot/var  'texte' :   ->  mot ? 'texte' :
  // (2 espaces ou plus avant la quote)
  out = out.replace(/([A-Za-z_][\w.]*)\s{2,}'([^']*)'\s*:/g, "$1 ? '$2' :");
  out = out.replace(/([A-Za-z_][\w.]*)\s{2,}"([^"]*)"\s*:/g, '$1 ? "$2" :');

  // Pattern:  ... > 0   expression :   (comparaison cassee)
  out = out.replace(/(\b\w+(?:\.\w+)*\s*(?:>=|<=|===|!==|==|!=|>|<)\s*\w+(?:\.\w+)*)\s{2,}([^?:\n]+?)\s*:/g, '$1 ? $2 :');

  // ${loading  '...' :
  out = out.replace(/\$\{([A-Za-z_][\w.]*)\s{2,}'([^']*)'\s*:/g, "${$1 ? '$2' :");
  out = out.replace(/\$\{([A-Za-z_][\w.]*)\s{2,}"([^"]*)"\s*:/g, '${$1 ? "$2" :');

  // nettoyage doubles
  out = out.split(' ? ? ').join(' ? ');
  out = out.split('isLast ? ? (').join('isLast ? (');

  return out;
}

const files = walk('app').concat(walk('components'), walk('lib'), walk('hooks'));
let n = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const out = repair(src);
  if (out !== src) {
    fs.writeFileSync(file, out, 'utf8');
    console.log('FIXED', file);
    n++;
  }
}
console.log('DONE', n, 'files');
