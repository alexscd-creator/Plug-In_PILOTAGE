import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../scripts/lint-plugin.mjs', import.meta.url))
const lint = dir => spawnSync('node', [script, dir], { encoding: 'utf8' })
const nouveau = () => mkdtempSync(join(tmpdir(), 'lint-'))
function ecrire(dir, rel, texte) {
  const f = join(dir, ...rel.split('/'))
  mkdirSync(join(f, '..'), { recursive: true })
  writeFileSync(f, texte)
}
const fm = (name, corps = '') => `---\nname: ${name}\ndescription: test\n---\n${corps}\n`

const PHRASES_SKILL = [
  'Une question à la fois.', 'Attendre la confirmation avant d\'écrire.', 'Proposer le workflow.', 'Les pôles du projet.',
  'Jamais de secret.', 'Rester dans la conversation principale, jamais dans un sous-agent.',
  'Enregistrer mon-workflow.json.', 'Ne jamais écraser un projet existant (écrasement interdit).',
]
const PHRASES_COMMANDE = ['check-projet', 'projet.json', 'plan.md', 'confirmation', 'config.json']

test('un plugin vide passe le lint', () => {
  assert.equal(lint(nouveau()).status, 0)
})

test('un skill sans frontmatter échoue', () => {
  const d = nouveau()
  ecrire(d, 'skills/un/SKILL.md', 'rien')
  const r = lint(d)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /frontmatter manquant/)
})

test('un skill dont le name ne correspond pas au dossier échoue', () => {
  const d = nouveau()
  ecrire(d, 'skills/un/SKILL.md', fm('autre'))
  const r = lint(d)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /devrait être « un »/)
})

test('<plugin> dans un skill échoue', () => {
  const d = nouveau()
  ecrire(d, 'skills/un/SKILL.md', fm('un', 'voir <plugin>/scripts'))
  assert.equal(lint(d).status, 1)
})

test('<plugin> dans un agent échoue', () => {
  const d = nouveau()
  ecrire(d, 'agents/ag.md', fm('ag', 'voir <plugin>/scripts'))
  const r = lint(d)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /agents\/ag\.md/)
})

test('un skill demarrage-guide auquel il manque une phrase échoue', () => {
  const d = nouveau()
  ecrire(d, 'skills/demarrage-guide/SKILL.md', fm('demarrage-guide', PHRASES_SKILL.filter(p => !/pôles/.test(p)).join('\n')))
  const r = lint(d)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /pôles/)
})

test('un skill demarrage-guide complet passe', () => {
  const d = nouveau()
  ecrire(d, 'skills/demarrage-guide/SKILL.md', fm('demarrage-guide', PHRASES_SKILL.join('\n')))
  assert.equal(lint(d).status, 0)
})

test('une commande demarrer incomplète échoue, complète passe', () => {
  const d = nouveau()
  ecrire(d, 'commands/demarrer.md', fm('demarrer', PHRASES_COMMANDE.slice(1).join('\n')))
  assert.equal(lint(d).status, 1)
  ecrire(d, 'commands/demarrer.md', fm('demarrer', PHRASES_COMMANDE.join('\n')))
  assert.equal(lint(d).status, 0)
})

test('le vrai plugin passe le lint', () => {
  const r = spawnSync('node', [script], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
})
