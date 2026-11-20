// Vérifie les agents et skills du plugin : frontmatter avec name et description,
// name identique au nom du fichier (agent) ou du dossier (skill).
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

function verifier(fichier, attendu) {
  const rel = fichier.slice(root.length + 1)
  const fm = frontmatter(readFileSync(fichier, 'utf8'))
  if (!fm) return erreurs.push(`${rel} : frontmatter manquant`)
  if (!fm.name) erreurs.push(`${rel} : name manquant`)
  else if (fm.name !== attendu) erreurs.push(`${rel} : name « ${fm.name} » devrait être « ${attendu} »`)
  if (!fm.description) erreurs.push(`${rel} : description manquante`)
}

const agents = join(root, 'agents')
if (existsSync(agents)) {
  for (const f of readdirSync(agents).filter(f => f.endsWith('.md'))) {
    verifier(join(agents, f), basename(f, '.md'))
  }
}

const skills = join(root, 'skills')
if (existsSync(skills)) {
  for (const d of readdirSync(skills)) {
    const skill = join(skills, d, 'SKILL.md')
    if (statSync(join(skills, d)).isDirectory() && existsSync(skill)) {
      verifier(skill, d)
      // Le dossier du plugin n'est pas connu d'avance : les chemins passent par la variable du moteur.
      if (readFileSync(skill, 'utf8').includes('<plugin>')) {
        erreurs.push(`skills/${d}/SKILL.md : écrire \${CLAUDE_PLUGIN_ROOT} au lieu de <plugin>`)
      }
    }
  }
}

if (erreurs.length) {
  console.error(erreurs.join('\n'))
  process.exit(1)
}
console.log('lint ok')
