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
  'Le vocabulaire suit le type de projet.', 'Les réglages propres au type.',
]
const PHRASES_COMMANDE = ['check-projet', 'projet.json', 'plan.md', 'confirmation', 'config.json', 'ecrire-projet']

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
test('un skill demarrage-guide sans vocabulaire, réglages ou type de projet échoue', () => {
  for (const mot of ['vocabulaire', 'réglages', 'type de projet']) {
    const d = nouveau()
    const corps = PHRASES_SKILL.map(p => p.replace(new RegExp(mot, 'i'), 'xxx')).join('\n')
    ecrire(d, 'skills/demarrage-guide/SKILL.md', fm('demarrage-guide', corps))
    const r = lint(d)
    assert.equal(r.status, 1, mot)
    assert.match(r.stderr, new RegExp(mot), mot)
  }
})

test('neutralité : « studio » ou « jeu » dans skills, commandes, hooks, scripts ou README échoue avec fichier:ligne', () => {
  const cas = [
    ['skills/un/SKILL.md', fm('un', 'ligne 1\nvotre studio ici')],
    ['skills/un/SKILL.md', fm('un', 'faire un jeu vidéo')],
    ['skills/un/SKILL.md', fm('un', 'les JEUX du soir')],
    ['commands/autre.md', '---\ndescription: test\n---\nvotre studio'],
    ['hooks/model/x.ts', '// le studio'],
    ['scripts/x.mjs', '// un jeu'],
    ['README.md', 'Bienvenue au studio'],
  ]
  for (const [rel, texte] of cas) {
    const d = nouveau()
    ecrire(d, rel, texte)
    const r = lint(d)
    assert.equal(r.status, 1, rel + ' : ' + texte)
    assert.ok(r.stderr.includes(rel + ':'), r.stderr)
    assert.match(r.stderr, /:\d+/)
  }
})

test('neutralité : le numéro de ligne est donné', () => {
  const d = nouveau()
  ecrire(d, 'skills/un/SKILL.md', fm('un', 'a\nb\nvotre studio'))
  assert.match(lint(d).stderr, /skills\/un\/SKILL\.md:7 /)
})

test('neutralité : « votre projet » passe, et un mot qui contient « jeu » ou « studio » passe', () => {
  const d = nouveau()
  ecrire(d, 'skills/un/SKILL.md', fm('un', 'votre projet, un enjeu, studios ?'))
  ecrire(d, 'README.md', "Le projet de l'équipe.")
  assert.equal(lint(d).status, 0)
})

test('neutralité : un manifeste dont l’auteur est « studio » échoue, « Pilotage » passe', () => {
  for (const [rel, cle] of [['.claude-plugin/plugin.json', 'author'], ['.claude-plugin/marketplace.json', 'owner']]) {
    const d = nouveau()
    // la présence de plugin.json exige le démarrage guidé complet
    ecrire(d, 'skills/demarrage-guide/SKILL.md', fm('demarrage-guide', PHRASES_SKILL.join('\n')))
    ecrire(d, 'commands/demarrer.md', fm('demarrer', PHRASES_COMMANDE.join('\n')))
    ecrire(d, rel, JSON.stringify({ name: 'x', [cle]: { name: 'studio' } }, null, 2))
    const r = lint(d)
    assert.equal(r.status, 1, rel)
    assert.ok(r.stderr.includes(rel + ':'), r.stderr)
    ecrire(d, rel, JSON.stringify({ name: 'x', [cle]: { name: 'Pilotage' } }, null, 2))
    assert.equal(lint(d).status, 0, rel)
  }
})

test('neutralité : package.json, types, agents et templates sont scannés', () => {
  for (const [rel, texte] of [['package.json', '{"description":"outil de jeu"}'], ['types/index.d.ts', '// le studio'], ['agents/a.md', fm('a', 'un jeu')], ['templates/t.md', 'le studio']]) {
    const d = nouveau()
    ecrire(d, rel, texte)
    const r = lint(d)
    assert.equal(r.status, 1, rel)
    assert.ok(r.stderr.includes(rel + ':'), r.stderr)
  }
})

test('neutralité : les presets, les tests et la documentation ne sont pas scannés', () => {
  const d = nouveau()
  ecrire(d, 'presets/jeu-roblox.json', '{"titre":"Jeu Roblox","outil":"Roblox Studio"}')
  ecrire(d, 'tests/x.spec.mjs', '// un jeu de test, un studio')
  ecrire(d, 'docs/maquette.md', 'le studio, le jeu')
  assert.equal(lint(d).status, 0)
})

test('le vrai plugin passe le lint', () => {
  const r = spawnSync('node', [script], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
})
