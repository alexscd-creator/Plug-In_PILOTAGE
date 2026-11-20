// Vérifie les agents et skills du plugin : frontmatter avec name et description,
// name identique au nom du fichier (agent) ou du dossier (skill), pas de <plugin> dans les chemins,
// et les phrases exigées du démarrage guidé (skill + commande).
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
]
export const REGLES_DEMARRER = [
  [/check-projet/, 'check-projet'],
  [/projet\.json/, 'projet.json'],
  [/plan\.md/, 'plan.md'],
  [/confirm/i, 'la confirmation'],
  [/config\.json/, 'config.json'],
  [/ecrire-projet/, 'ecrire-projet'],
]

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

if (erreurs.length) {
  console.error(erreurs.join('\n'))
  process.exit(1)
}
console.log('lint ok')
