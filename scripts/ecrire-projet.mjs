// Écrit le projet après confirmation (avec son vocabulaire, ses définitions de réglages et leurs valeurs) : `.pilotage/projet.json`, `plan.md`, `equipe/<prénom>/portes.md`, `agents/<id>.md`.
// Usage : node scripts/ecrire-projet.mjs <dossier> <reponses.json>
// Codes : 0 écrit ; 1 réponses invalides (rien n'est écrit) ; 3 projet.json existe déjà (rien n'est écrit) ;
//   4 écriture impossible (tout ce que ce lancement avait créé est retiré, rien n'est resté) ;
//   5 dossier introuvable ou qui n'est pas un dossier (rien n'est créé) ; 64 usage incorrect.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseProjet, serializeProjet } from '../hooks/model/projet.ts'
import { genererPlan } from '../hooks/model/plan.ts'

const [dossierArg, reponsesArg] = process.argv.slice(2)
if (!dossierArg || !reponsesArg) {
  console.error('usage : node scripts/ecrire-projet.mjs <dossier> <reponses.json>')
  process.exit(64)
}
const echec = (messages, code = 1) => { console.error([].concat(messages).join('\n')); process.exit(code) }

try {
  principal()
} catch (e) {
  echec(`Erreur inattendue : ${e instanceof Error ? e.message : 'inconnue'}. Rien n'est écrit ou ce qui l'était a été retiré.`, 4)
}

function principal() {
const dossier = resolve(dossierArg)
try {
  if (!statSync(dossier).isDirectory()) echec(`« ${dossier} » n'est pas un dossier : rien n'est créé.`, 5)
} catch {
  echec(`Le dossier « ${dossier} » est introuvable : rien n'est créé.`, 5)
}
const pilotage = join(dossier, '.pilotage')
if (existsSync(join(pilotage, 'projet.json'))) echec(`Un projet existe déjà (${join(pilotage, 'projet.json')}) : rien n'est écrit. Utiliser /pilotage.`, 3)

let reponses
try { reponses = JSON.parse(readFileSync(resolve(reponsesArg), 'utf8')) } catch (e) {
  echec(`Les réponses sont illisibles ou ne sont pas du JSON (${e instanceof Error ? e.message : 'erreur inconnue'}).`)
}
if (typeof reponses !== 'object' || reponses === null || Array.isArray(reponses)) echec('Les réponses doivent être un objet JSON.')

const r = parseProjet(JSON.stringify({
  version: 1, nom: reponses.nom, but: reponses.but, fini: reponses.fini, preset: reponses.preset, equipe: reponses.equipe,
  poles: reponses.poles, phases: reponses.phases, agents: reponses.agents, workflow: reponses.workflow,
  vocabulaire: reponses.vocabulaire, reglagesDef: reponses.reglagesDef, reglages: reponses.reglages,
}))
if (!r.ok) echec(r.erreurs)
const projet = r.projet

// Ces identifiants deviennent des noms de fichier ou des repères du plan : alphabet restreint.
const erreurs = []
const ID = /^[a-z0-9-]+$/
const RESERVES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/
const MAX = 60
const verifierNom = (quoi, nom) => {
  if (nom.length > MAX) erreurs.push(`${quoi} « ${nom.slice(0, 20)}... » dépasse ${MAX} caractères.`)
  if (RESERVES.test(nom)) erreurs.push(`${quoi} « ${nom} » est un nom réservé par Windows.`)
}
for (const [genre, liste] of [['pôle', projet.poles], ['phase', projet.phases], ['agent', projet.agents]])
  for (const x of liste) if (!ID.test(x.id)) erreurs.push(`L'identifiant du ${genre} « ${x.id.slice(0, 20)} » doit s'écrire en minuscules, chiffres et tirets seulement.`)
    else verifierNom(`L'identifiant du ${genre}`, x.id)

const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const slugs = projet.equipe.map(slug)
slugs.forEach((sl, i) => { if (sl !== '') verifierNom(`Le dossier du prénom « ${projet.equipe[i].slice(0, 20)} »`, sl) })
slugs.forEach((sl, i) => { if (sl === '') erreurs.push(`Le prénom « ${projet.equipe[i]} » ne donne aucun nom de dossier valide.`) })
slugs.forEach((sl, i) => { if (sl !== '' && slugs.indexOf(sl) !== i) erreurs.push(`Les prénoms « ${projet.equipe[slugs.indexOf(sl)]} » et « ${projet.equipe[i]} » donnent le même dossier.`) })
if (erreurs.length) echec(erreurs)

const ligne = s => String(s).replace(/\s*[\r\n]+\s*/g, ' ').trim()
const fichiers = []
const crees = [] // tout ce que ce lancement a créé, dans l'ordre : retiré à l'envers en cas d'échec
function dossierSur(d) {
  if (existsSync(d)) return
  dossierSur(join(d, '..'))
  mkdirSync(d)
  crees.push(d)
}
function ecrire(rel, texte) {
  const f = join(pilotage, ...rel.split('/'))
  dossierSur(join(f, '..'))
  writeFileSync(f, texte, { flag: 'wx' })
  crees.push(f)
  fichiers.push('.pilotage/' + rel)
}

try {
  ecrire('projet.json', serializeProjet(projet))
  ecrire('plan.md', genererPlan(projet))
  slugs.forEach(sl => ecrire(`equipe/${sl}/portes.md`, ''))
  for (const a of projet.agents) {
    const pole = projet.poles.find(p => p.id === a.pole)
    ecrire(`agents/${a.id}.md`, [
      `# ${ligne(a.titre)}`, '',
      `- Pôle : ${ligne(pole ? pole.titre : a.pole)}`,
      `- Pourquoi spécialisé : ${ligne(a.pourquoi)}`,
      `- Skills : ${a.skills.length ? a.skills.map(ligne).join(', ') : 'aucun'} (certains peuvent ne pas être installés)`, '',
    ].join('\n'))
  }
} catch (e) {
  for (const c of crees.reverse()) { try { rmSync(c, { recursive: true, force: true }) } catch { /* reste à la main */ } }
  echec(`Écriture impossible (${e instanceof Error ? e.message : 'erreur inconnue'}) : rien n'est resté.`, 4)
}
console.log(`projet écrit : ${fichiers.join(', ')}`)
}
