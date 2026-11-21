// Écrit le projet après confirmation (avec son vocabulaire, ses définitions de réglages et leurs valeurs) : `.pilotage/projet.json`, `plan.md`, `equipe/<prénom>/portes.md`, `agents/<id>.md`.
// Usage : node scripts/ecrire-projet.mjs <dossier> <reponses.json>
// Codes : 0 écrit ; 1 réponses invalides (rien n'est écrit) ; 3 projet.json existe déjà (rien n'est écrit) ;
//   4 écriture impossible (tout ce que ce lancement avait créé est retiré, rien n'est resté) ;
//   5 dossier introuvable ou qui n'est pas un dossier (rien n'est créé) ; 64 usage incorrect.
// Les garanties communes (transaction, noms sûrs, dossier valide, import du modèle) viennent de scripts/lib/ecriture.mjs.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ID, Transaction, dossierExistant, echec, erreursNom, importerModele, ligne, slug } from './lib/ecriture.mjs'

const [dossierArg, reponsesArg] = process.argv.slice(2)
if (!dossierArg || !reponsesArg) {
  console.error('usage : node scripts/ecrire-projet.mjs <dossier> <reponses.json>')
  process.exit(64)
}

const [{ parseProjet, serializeProjet }, { genererPlan }] = await importerModele(['projet', 'plan'], 4)
try {
  principal()
} catch (e) {
  echec(`Erreur inattendue : ${e instanceof Error ? e.message : 'inconnue'}. Rien n'est écrit ou ce qui l'était a été retiré.`, 4)
}

function principal() {
const dossier = dossierExistant(dossierArg)
const pilotage = join(dossier, '.pilotage')
if (existsSync(join(pilotage, 'projet.json'))) echec(`Un projet existe déjà (${join(pilotage, 'projet.json')}) : rien n'est écrit. Utiliser /projet pour ouvrir le panneau.`, 3)

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
for (const [genre, liste] of [['pôle', projet.poles], ['phase', projet.phases], ['agent', projet.agents]])
  for (const x of liste) if (!ID.test(x.id)) erreurs.push(`L'identifiant du ${genre} « ${x.id.slice(0, 20)} » doit s'écrire en minuscules, chiffres et tirets seulement.`)
    else erreurs.push(...erreursNom(`L'identifiant du ${genre}`, x.id))

const slugs = projet.equipe.map(slug)
slugs.forEach((sl, i) => { if (sl !== '') erreurs.push(...erreursNom(`Le dossier du prénom « ${projet.equipe[i].slice(0, 20)} »`, sl)) })
slugs.forEach((sl, i) => { if (sl === '') erreurs.push(`Le prénom « ${projet.equipe[i]} » ne donne aucun nom de dossier valide.`) })
slugs.forEach((sl, i) => { if (sl !== '' && slugs.indexOf(sl) !== i) erreurs.push(`Les prénoms « ${projet.equipe[slugs.indexOf(sl)]} » et « ${projet.equipe[i]} » donnent le même dossier.`) })
if (erreurs.length) echec(erreurs)

const fichiers = []
const tx = new Transaction() // tout ce que ce lancement crée : retiré en cas d'échec
function ecrire(rel, texte) {
  tx.ecrire(join(pilotage, ...rel.split('/')), texte)
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
  tx.annuler()
  echec(`Écriture impossible (${e instanceof Error ? e.message : 'erreur inconnue'}) : rien n'est resté.`, 4)
}
console.log(`projet écrit : ${fichiers.join(', ')}`)
}
