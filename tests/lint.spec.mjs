import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
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

const PHRASES_CHANTIER = [
  'Demander la confirmation avant de créer le chantier.',
  'La sous-session n’est jamais lancée automatiquement.',
  'Appeler mcp__ccd_session__start_session seul dans son message.',
  'Passer initiation: "offer" et un title.',
  'Rappeler l’outil avec le proposal_id reçu, context: "fresh", use_worktree: false.',
  'Écrire la fiche avec scripts/pilotage-chantier.mjs.',
  'Ne jamais écrire une fiche à la main.',
  'Déléguer le contrôle d’impact à l’agent chef-de-chantier.',
  'Charger le skill chantier-pilotage.',
  'La sous-session commence par /pilotage:chantier ouvrir <id>.',
  'Actions du script : lier-session et archiver.',
  'Écrire la passation avant d’archiver, avec --force-report seulement après accord.',
  'Si l’outil est absent, dire d’ouvrir une nouvelle session.',
]
const PHRASES_PHASE = [
  'Une porte se valide seulement si portePossible est ok.',
  'Demander la confirmation avant forcer ou repondre, puis passer --confirme.',
  'Ne jamais forcer en silence.',
  'Écrire avec scripts/pilotage-chantier.mjs, action porte.',
  'Ne jamais écrire les portes à la main.',
  'L’utilisateur choisit : terminer, reporter ou abandonner chaque tâche ouverte.',
]
const PHRASES_SKILL_CHANTIER = [
  'Demander la confirmation avant d’écrire.',
  'Ne jamais écrire une fiche à la main : utiliser scripts/pilotage-chantier.mjs.',
  'Le contrôle d’impact liste les pôles et les agents concernés.',
  'On n’écrit que chez soi : le dossier equipe/<prénom>/.',
  'Rester dans la conversation principale.',
  'Écrire la passation avant l’archivage.',
  'Le plan se modifie une personne à la fois.',
]
const PHRASES_AGENT_CHEF = [
  'Agent en lecture seule.',
  'Il fait le contrôle d’impact.',
  'Il demande la confirmation de l’utilisateur.',
  'Les scripts sont lancés par la conversation principale, jamais par lui.',
  'Les fiches s’écrivent avec pilotage-chantier.',
]
const agentChef = (tools = 'Read, Glob, Grep', corps = PHRASES_AGENT_CHEF.join('\n')) =>
  `---
name: chef-de-chantier
description: test
tools: ${tools}
---
${corps}
`
function chantierComplet(d) {
  ecrire(d, 'commands/chantier.md', fm('chantier', PHRASES_CHANTIER.join('\n')))
  ecrire(d, 'commands/phase.md', fm('phase', PHRASES_PHASE.join('\n')))
  ecrire(d, 'skills/chantier-pilotage/SKILL.md', fm('chantier-pilotage', PHRASES_SKILL_CHANTIER.join('\n')))
  ecrire(d, 'agents/chef-de-chantier.md', agentChef())
}

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
    // la présence de plugin.json exige le démarrage guidé et les chantiers complets
    ecrire(d, 'skills/demarrage-guide/SKILL.md', fm('demarrage-guide', PHRASES_SKILL.join('\n')))
    ecrire(d, 'commands/demarrer.md', fm('demarrer', PHRASES_COMMANDE.join('\n')))
    chantierComplet(d)
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

test('chantier : le jeu complet de fichiers passe ; sans un fichier, le lint échoue', () => {
  const d = nouveau()
  chantierComplet(d)
  assert.equal(lint(d).status, 0, lint(d).stderr)
  for (const rel of ['commands/chantier.md', 'commands/phase.md', 'skills/chantier-pilotage/SKILL.md', 'agents/chef-de-chantier.md']) {
    const e = nouveau(); chantierComplet(e)
    rmSync(join(e, ...rel.split('/')))
    const r = lint(e)
    assert.equal(r.status, 1, rel)
    assert.match(r.stderr, /fichier manquant/)
  }
})

test('chantier : une phrase obligatoire en moins échoue, pour la commande, /phase, le skill et l’agent', () => {
  const cas = [
    ['commands/chantier.md', 'chantier', PHRASES_CHANTIER], ['commands/phase.md', 'phase', PHRASES_PHASE],
    ['skills/chantier-pilotage/SKILL.md', 'chantier-pilotage', PHRASES_SKILL_CHANTIER],
  ]
  for (const [rel, nom, phrases] of cas) {
    for (const [i, p] of phrases.entries()) {
      const d = nouveau(); chantierComplet(d)
      ecrire(d, rel, fm(nom, phrases.filter((_, k) => k !== i).join('\n')))
      const r = lint(d)
      assert.equal(r.status, 1, rel + ' sans : ' + p)
      assert.ok(r.stderr.includes(rel), r.stderr)
    }
  }
  for (const [i, p] of PHRASES_AGENT_CHEF.entries()) {
    const d = nouveau(); chantierComplet(d)
    ecrire(d, 'agents/chef-de-chantier.md', agentChef('Read, Glob, Grep', PHRASES_AGENT_CHEF.filter((_, k) => k !== i).join('\n')))
    assert.equal(lint(d).status, 1, 'agent sans : ' + p)
  }
})

test('chantier : l’agent chef-de-chantier ne doit avoir que des outils de lecture', () => {
  for (const tools of ['Read, Glob, Grep, Write', 'Edit', 'Bash', 'Read, PowerShell', 'Read, mcp__ccd_session__start_session']) {
    const d = nouveau(); chantierComplet(d)
    ecrire(d, 'agents/chef-de-chantier.md', agentChef(tools))
    const r = lint(d)
    assert.equal(r.status, 1, tools)
    assert.match(r.stderr, /lecture/)
  }
  const d = nouveau(); chantierComplet(d)
  ecrire(d, 'agents/chef-de-chantier.md', `---
name: chef-de-chantier
description: test
---
${PHRASES_AGENT_CHEF.join('\n')}
`)
  assert.equal(lint(d).status, 1)
})

test('le vrai plugin passe le lint', () => {
  const r = spawnSync('node', [script], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
})
