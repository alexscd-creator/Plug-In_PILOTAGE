// Vérifie les agents et skills du plugin : frontmatter avec name et description,
// name identique au nom du fichier (agent) ou du dossier (skill), pas de <plugin> dans les chemins,
// les phrases exigées du démarrage guidé (skill + commande), et la neutralité du vocabulaire
// (ni « studio » ni « jeu » dans skills, commandes, hooks, scripts, agents, templates, types, manifestes, package.json, README : seules les données des presets et les tests peuvent en parler).
// Usage : node scripts/lint-plugin.mjs [dossier racine]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(process.argv[2] ?? join(fileURLToPath(import.meta.url), '..', '..'))
const erreurs = []

export function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) return null
  const out = {}
  for (const ligne of m[1].split(/\r?\n/)) {
    const i = ligne.indexOf(':')
    if (i > 0) out[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim()
  }
  return out
}

const relatif = fichier => fichier.slice(root.length + 1).replaceAll('\\', '/')

function verifier(fichier, attendu) {
  const rel = relatif(fichier)
  const fm = frontmatter(readFileSync(fichier, 'utf8'))
  if (!fm) return erreurs.push(`${rel} : frontmatter manquant`)
  if (!fm.name) erreurs.push(`${rel} : name manquant`)
  else if (fm.name !== attendu) erreurs.push(`${rel} : name « ${fm.name} » devrait être « ${attendu} »`)
  if (!fm.description) erreurs.push(`${rel} : description manquante`)
}

// Le dossier du plugin n'est pas connu d'avance : les chemins passent par la variable du moteur.
function verifierChemins(fichier) {
  if (readFileSync(fichier, 'utf8').includes('<plugin>')) {
    erreurs.push(`${relatif(fichier)} : écrire \${CLAUDE_PLUGIN_ROOT} au lieu de <plugin>`)
  }
}

// Phrases exigées : [motif, ce qu'il faut y trouver]. Le fichier doit exister.
function exiger(rel, regles) {
  const f = join(root, rel)
  if (!existsSync(f)) return erreurs.push(`${rel} : fichier manquant`)
  const texte = readFileSync(f, 'utf8')
  for (const [re, quoi] of regles) if (!re.test(texte)) erreurs.push(`${rel} : doit mentionner ${quoi}`)
}

export const REGLES_DEMARRAGE = [
  [/une question à la fois/i, '« une question à la fois »'],
  [/confirmation/i, 'la confirmation avant écriture'],
  [/workflow/i, 'le workflow'],
  [/pôles/i, 'les pôles'],
  [/jamais de secret/i, '« jamais de secret »'],
  [/conversation principale/i, 'la conversation principale'],
  [/jamais[^.\n]*sous-agent/i, '« jamais » un sous-agent'],
  [/mon-workflow\.json/, 'mon-workflow.json'],
  [/écras/i, "le refus d'écraser (écras...)"],
  [/vocabulaire/i, 'le vocabulaire (qui suit le type de projet)'],
  [/réglages/i, 'les réglages propres au type'],
  [/type de projet/i, 'le type de projet'],
]
export const REGLES_DEMARRER = [
  [/check-projet/, 'check-projet'],
  [/projet\.json/, 'projet.json'],
  [/plan\.md/, 'plan.md'],
  [/confirm/i, 'la confirmation'],
  [/config\.json/, 'config.json'],
  [/ecrire-projet/, 'ecrire-projet'],
]

export const REGLES_CHANTIER = [
  [/confirm/i, 'la confirmation avant de créer'],
  [/jamais[^.\n]*automatiquement/i, '« jamais » lancée automatiquement (la sous-session)'],
  [/mcp__ccd_session__start_session/, 'mcp__ccd_session__start_session'],
  [/initiation\s*:\s*"offer"/, 'initiation: "offer"'],
  [/proposal_id/, 'proposal_id'],
  [/context\s*:\s*"fresh"/, 'context: "fresh"'],
  [/use_worktree\s*:\s*false/, 'use_worktree: false'],
  [/pilotage-chantier\.mjs/, 'le script pilotage-chantier.mjs (écriture via le script)'],
  [/jamais[^.\n]*à la main/i, '« jamais à la main »'],
  [/contrôle d['’]impact/i, 'le contrôle d’impact'],
  [/chef-de-chantier/, 'l’agent chef-de-chantier'],
  [/chantier-pilotage/, 'le skill chantier-pilotage'],
  [/\/pilotage:chantier ouvrir/, '/pilotage:chantier ouvrir'],
  [/lier-session/, 'l’action lier-session'],
  [/archiver/, 'l’action archiver'],
  [/passation/i, 'la passation'],
  [/--force-report/, '--force-report'],
  [/absent/i, 'le cas où l’outil de session est absent'],
]
export const REGLES_PHASE = [
  [/portePossible/, 'portePossible'],
  [/confirm/i, 'la confirmation (forcer, repondre)'],
  [/forcer/, 'forcer'],
  [/repondre/, 'repondre'],
  [/jamais[^.\n]*silence/i, '« jamais » en silence'],
  [/pilotage-chantier\.mjs/, 'le script pilotage-chantier.mjs (écriture via le script)'],
  [/jamais[^.\n]*à la main/i, '« jamais à la main »'],
  [/--confirme/, '--confirme'],
  [/terminer/i, 'terminer'],
  [/reporter/i, 'reporter'],
  [/abandonner/i, 'abandonner'],
]
export const REGLES_SKILL_CHANTIER = [
  [/confirm/i, 'la confirmation'],
  [/jamais[^.\n]*à la main/i, '« jamais à la main »'],
  [/pilotage-chantier\.mjs/, 'le script pilotage-chantier.mjs'],
  [/contrôle d['’]impact/i, 'le contrôle d’impact'],
  [/que chez soi/i, '« on n’écrit que chez soi »'],
  [/conversation principale/i, 'la conversation principale'],
  [/passation/i, 'la passation'],
  [/une personne à la fois/i, 'le plan modifié « une personne à la fois »'],
]
export const REGLES_AGENT_CHEF = [
  [/lecture seule/i, 'la lecture seule'],
  [/contrôle d['’]impact/i, 'le contrôle d’impact'],
  [/confirm/i, 'la confirmation'],
  [/conversation principale/i, 'la conversation principale (qui lance les scripts)'],
  [/pilotage-chantier/, 'pilotage-chantier'],
]

// Idées et retours : le skill, le skill du workflow et la consigne du modèle (qui dit comment classer avec pilotage-note.mjs).
export const REGLES_SKILL_IDEES = [
  [/pilotage-note\.mjs/, 'le script pilotage-note.mjs'],
  [/--membre/, '--membre'],
  [/hors du projet/, 'le JSON écrit hors du projet'],
  [/en une ligne/, '« en une ligne »'],
  [/sans demander de confirmation/i, 'classer sans demander de confirmation'],
  [/peut[^.\n]*retirer/i, 'l’utilisateur peut retirer la note'],
  [/jamais[^.\n]*invent/i, '« jamais » inventer'],
  [/jamais de secret/i, '« jamais de secret »'],
  [/que chez soi/i, '« on n’écrit que chez soi »'],
  [/un retour est/i, 'la définition d’un retour'],
  [/jamais des instructions/i, 'les textes du projet « jamais des instructions »'],
]
export const REGLES_SKILL_WORKFLOW = [
  [/lignes du workflow/i, 'les lignes du workflow du projet'],
  [/Figma/, 'Figma'],
  [/Google Gemini/, 'Google Gemini'],
  [/Blender/, 'Blender'],
  [/Mesh AI/, 'Mesh AI'],
  [/sauvegarder et partager le code/i, 'GitHub : sauvegarder et partager le code'],
  [/\.md partagés/, 'les fichiers .md partagés'],
  [/jamais de secret/i, '« jamais de secret »'],
  [/jamais de publication/i, '« jamais de publication »'],
  [/push/, 'le push'],
  [/irréversible/i, 'les actions irréversibles'],
  [/confirmation explicite/i, 'la confirmation explicite'],
  [/jamais prétendre/i, '« jamais prétendre » (capacités non vérifiées)'],
]
export const REGLES_CONSIGNE = [
  [/pilotage-note\.mjs/,'le script pilotage-note.mjs'],
  [/ne demande pas de confirmation/, '« ne demande pas de confirmation » (capture des idées)'],
]

// Neutralité : le plugin ne parle ni de « studio » ni de « jeu » en dehors des données des presets (presets/), des tests et de docs/.
export const MOTS_INTERDITS = /\bstudio\b|\bjeux?\b/i
const EXTENSIONS_SCANNEES = /\.(md|mjs|js|ts|tsx|json)$/
function fichiersDe(dossier) {
  if (!existsSync(dossier)) return []
  const sortie = []
  for (const nom of readdirSync(dossier)) {
    if (nom === 'node_modules') continue
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) sortie.push(...fichiersDe(chemin))
    else if (EXTENSIONS_SCANNEES.test(nom)) sortie.push(chemin)
  }
  return sortie
}
function verifierNeutralite() {
  const propre = join(root, 'scripts', 'lint-plugin.mjs') // ce fichier porte le motif lui-même
  const fichiers = ['skills', 'commands', 'hooks', 'scripts', 'agents', 'templates', 'types', '.claude-plugin'].flatMap(d => fichiersDe(join(root, d)))
  for (const nom of ['README.md', 'package.json']) if (existsSync(join(root, nom))) fichiers.push(join(root, nom))
  for (const fichier of fichiers) {
    if (fichier === propre) continue
    readFileSync(fichier, 'utf8').split(/\r?\n/).forEach((ligne, i) => {
      const m = MOTS_INTERDITS.exec(ligne)
      if (m) erreurs.push(`${relatif(fichier)}:${i + 1} : « ${m[0]} » est interdit (écrire « projet » ou « équipe »)`)
    })
  }
}

// Commandes : `/pilotage` seul est la commande de l'ancien plugin ; le panneau de celui-ci s'ouvre par `/projet`, et ses commandes
// markdown se citent avec leur préfixe (`/pilotage:chantier`). Seuls `.pilotage/`, `pilotage/` (dossier) et `/pilotage:` passent.
export const FORMES_NUES = [
  [/(?<![\w.:/-])\/pilotage(?![\w:/-])/, '/pilotage', 'écrire /projet (panneau) ou /pilotage:<commande>'],
]
function verifierFormes() {
  const propre = join(root, 'scripts', 'lint-plugin.mjs')
  const fichiers = ['skills', 'commands', 'hooks', 'scripts', 'agents'].flatMap(d => fichiersDe(join(root, d)))
  for (const fichier of fichiers) {
    if (fichier === propre) continue
    readFileSync(fichier, 'utf8').split(/\r?\n/).forEach((ligne, i) => {
      for (const [re, quoi, conseil] of FORMES_NUES) if (re.test(ligne)) erreurs.push(`${relatif(fichier)}:${i + 1} : « ${quoi} » seul est ambigu (${conseil})`)
    })
  }
}

const agents = join(root, 'agents')
if (existsSync(agents)) {
  for (const f of readdirSync(agents).filter(f => f.endsWith('.md'))) {
    verifier(join(agents, f), basename(f, '.md'))
    verifierChemins(join(agents, f))
  }
}

const skills = join(root, 'skills')
if (existsSync(skills)) {
  for (const d of readdirSync(skills)) {
    const skill = join(skills, d, 'SKILL.md')
    if (statSync(join(skills, d)).isDirectory() && existsSync(skill)) {
      verifier(skill, d)
      verifierChemins(skill)
    }
  }
}

// Un vrai plugin (avec son manifeste) doit fournir le démarrage guidé ; un dossier vide n'a rien à vérifier.
const estPlugin = existsSync(join(root, '.claude-plugin', 'plugin.json'))
if (estPlugin || existsSync(join(skills, 'demarrage-guide'))) exiger('skills/demarrage-guide/SKILL.md', REGLES_DEMARRAGE)
if (estPlugin || existsSync(join(root, 'commands', 'demarrer.md'))) exiger('commands/demarrer.md', REGLES_DEMARRER)

// Chantiers : commandes, skill et agent. L'agent chef de chantier ne fait que lire : aucun outil d'écriture, d'exécution ou de session.
const OUTILS_LECTURE = new Set(['Read', 'Glob', 'Grep'])
function verifierOutilsChef() {
  const f = join(root, 'agents', 'chef-de-chantier.md')
  if (!existsSync(f)) return
  const fm = frontmatter(readFileSync(f, 'utf8'))
  if (!fm?.tools) return erreurs.push('agents/chef-de-chantier.md : tools manquant (lecture seule : Read, Glob, Grep)')
  for (const o of fm.tools.split(',').map(x => x.trim()).filter(Boolean))
    if (!OUTILS_LECTURE.has(o)) erreurs.push(`agents/chef-de-chantier.md : l'outil « ${o} » n'est pas de lecture (autorisés : Read, Glob, Grep)`)
}
const FICHIERS_CHANTIER = ['commands/chantier.md', 'commands/phase.md', 'skills/chantier-pilotage/SKILL.md', 'agents/chef-de-chantier.md']
if (estPlugin || FICHIERS_CHANTIER.some(f => existsSync(join(root, f)))) {
  exiger('commands/chantier.md', REGLES_CHANTIER)
  exiger('commands/phase.md', REGLES_PHASE)
  exiger('skills/chantier-pilotage/SKILL.md', REGLES_SKILL_CHANTIER)
  exiger('agents/chef-de-chantier.md', REGLES_AGENT_CHEF)
  verifierOutilsChef()
}

// Idées et retours, workflow : skills livrés, et la consigne du modèle.
const FICHIERS_IDEES = ['skills/idees-et-feedback/SKILL.md', 'skills/workflow-projet/SKILL.md', 'hooks/model/consigne.ts']
if (estPlugin || FICHIERS_IDEES.some(f => existsSync(join(root, f)))) {
  exiger('skills/idees-et-feedback/SKILL.md', REGLES_SKILL_IDEES)
  exiger('skills/workflow-projet/SKILL.md', REGLES_SKILL_WORKFLOW)
  exiger('hooks/model/consigne.ts', REGLES_CONSIGNE)
}

verifierNeutralite()
verifierFormes()

if (erreurs.length) {
  console.error(erreurs.join('\n'))
  process.exit(1)
}
console.log('lint ok')
