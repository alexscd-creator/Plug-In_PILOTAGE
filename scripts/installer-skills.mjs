// Installe dans `.pilotage/skills/` les skills cités par les agents du projet qui n'y sont pas encore (projet créé avant la livraison
// des skills, skill supprimé par erreur...). Chaque skill vient du preset du projet (presets/skills/<preset>/<skill>.md) ; sans fichier de
// preset, il reçoit le modèle « à compléter ». Un skill déjà présent n'est JAMAIS touché, même modifié.
// Usage : node scripts/installer-skills.mjs <dossier du projet>
// Codes : 0 fait (même s'il n'y avait rien à installer) ; 1 projet invalide ou chemin non sûr (rien n'est écrit) ;
//   4 écriture impossible (tout ce que ce lancement avait créé est retiré) ; 5 dossier introuvable ou sans projet ; 64 usage incorrect.
// Rien ne s'écrit en dehors de `.pilotage/skills/` (ni au travers d'un lien ou d'une jonction qui mène hors du projet).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CheminNonSur, ID, Transaction, dossierExistant, echec, erreursNom, importerModele, texteSkill, verifierChemin } from './lib/ecriture.mjs'

const args = process.argv.slice(2)
if (args.length !== 1 || args[0].startsWith('--')) {
  console.error('usage : node scripts/installer-skills.mjs <dossier du projet>')
  process.exit(64)
}

const [{ parseProjet }] = await importerModele(['projet'], 4)
const tx = new Transaction()

function principal() {
  const dossier = dossierExistant(args[0])
  const fichier = join(dossier, '.pilotage', 'projet.json')
  if (!existsSync(fichier)) echec(`Aucun projet Pilotage dans « ${dossier} » (.pilotage/projet.json absent) : rien n'est écrit.`, 5)
  let r
  try { r = parseProjet(readFileSync(fichier, 'utf8')) } catch { echec("Le fichier projet est illisible : rien n'est écrit.") }
  if (!r.ok) echec(r.erreurs)
  const projet = r.projet
  const cites = [...new Set(projet.agents.flatMap(a => a.skills))]
  if (cites.length === 0) return console.log('Aucun skill à installer : aucun agent du projet n\'en utilise.')
  const erreurs = []
  for (const sk of cites)
    if (typeof sk !== 'string' || !ID.test(sk)) erreurs.push(`Le nom du skill « ${String(sk).slice(0, 20)} » doit s'écrire en minuscules, chiffres et tirets seulement : il n'est pas installé.`)
    else erreurs.push(...erreursNom('Le nom du skill', sk))
  if (erreurs.length) echec(erreurs)
  tx.proteger(dossier)
  const skills = join(dossier, '.pilotage', 'skills')
  verifierChemin(dossier, skills)
  const installes = []
  let presents = 0
  for (const sk of cites) {
    const f = join(skills, `${sk}.md`)
    if (existsSync(f)) { presents++; continue }
    tx.ecrire(f, texteSkill(projet.preset, sk))
    installes.push(sk)
  }
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`
  console.log(`${pluriel(installes.length, 'skill installé')}${installes.length ? ` (${installes.join(', ')})` : ''} ; ${presents} déjà présent${presents > 1 ? 's' : ''}, laissé${presents > 1 ? 's' : ''} tel${presents > 1 ? 's' : ''} quel${presents > 1 ? 's' : ''}.`)
}

try {
  principal()
} catch (e) {
  tx.annuler()
  if (e instanceof CheminNonSur) echec(e.message, 1)
  echec(`Écriture impossible (${e instanceof Error ? e.message.split(String.fromCharCode(10))[0] : 'erreur inconnue'}) : tout est remis comme avant.`, 4)
}
