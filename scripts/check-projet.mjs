// Vérifie le marqueur `.pilotage/projet.json` en remontant depuis un dossier.
// Usage : node scripts/check-projet.mjs <dossier>
// Sortie : `projet ok` (code 0) ; les erreurs de parseProjet, une par ligne (code 1) ; `aucun projet` (code 2), usage incorrect (code 64).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseProjet } from '../hooks/model/projet.ts'

const dossier = process.argv[2]
if (!dossier) {
  console.error('usage : node scripts/check-projet.mjs <dossier>')
  process.exit(64)
}

let courant = resolve(dossier)
for (;;) {
  const marqueur = join(courant, '.pilotage', 'projet.json')
  if (existsSync(marqueur)) {
    let r
    try {
      r = parseProjet(readFileSync(marqueur, 'utf8'))
    } catch (e) {
      console.log(`Le fichier projet est illisible (${e instanceof Error ? e.message : 'erreur inconnue'}).`)
      process.exit(1)
    }
    if (r.ok) {
      console.log('projet ok')
      process.exit(0)
    }
    console.log(r.erreurs.join('\n'))
    process.exit(1)
  }
  const parent = dirname(courant)
  if (parent === courant) break
  courant = parent
}
console.log('aucun projet')
process.exit(2)
