// Écrit le projet après confirmation : `.pilotage/projet.json`, `plan.md`, `equipe/<prénom>/portes.md`, `agents/<id>.md`.
// Usage : node scripts/ecrire-projet.mjs <dossier> <reponses.json>
// Codes : 0 écrit ; 1 réponses invalides (rien n'est écrit) ; 3 projet.json existe déjà (rien n'est écrit) ; 64 usage.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseProjet, serializeProjet } from '../hooks/model/projet.ts'
import { genererPlan } from '../hooks/model/plan.ts'

const [dossierArg, reponsesArg] = process.argv.slice(2)
if (!dossierArg || !reponsesArg) {
  console.error('usage : node scripts/ecrire-projet.mjs <dossier> <reponses.json>')
  process.exit(64)
}
const echec = (messages, code = 1) => { console.error([].concat(messages).join('\n')); process.exit(code) }

const dossier = resolve(dossierArg)
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
}))
if (!r.ok) echec(r.erreurs)
const projet = r.projet

// Ces identifiants deviennent des noms de fichier ou des repères du plan : alphabet restreint.
const erreurs = []
const ID = /^[a-z0-9-]+$/
for (const [genre, liste] of [['pôle', projet.poles], ['phase', projet.phases], ['agent', projet.agents]])
  for (const x of liste) if (!ID.test(x.id)) erreurs.push(`L'identifiant du ${genre} « ${x.id} » doit s'écrire en minuscules, chiffres et tirets seulement.`)

const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const slugs = projet.equipe.map(slug)
slugs.forEach((sl, i) => { if (sl === '') erreurs.push(`Le prénom « ${projet.equipe[i]} » ne donne aucun nom de dossier valide.`) })
slugs.forEach((sl, i) => { if (sl !== '' && slugs.indexOf(sl) !== i) erreurs.push(`Les prénoms « ${projet.equipe[slugs.indexOf(sl)]} » et « ${projet.equipe[i]} » donnent le même dossier.`) })
if (erreurs.length) echec(erreurs)

const ligne = s => String(s).replace(/\s*[\r\n]+\s*/g, ' ').trim()
const fichiers = []
function ecrire(rel, texte) {
  const f = join(pilotage, ...rel.split('/'))
  mkdirSync(join(f, '..'), { recursive: true })
  writeFileSync(f, texte)
  fichiers.push('.pilotage/' + rel)
}

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
console.log(`projet écrit : ${fichiers.join(', ')}`)
