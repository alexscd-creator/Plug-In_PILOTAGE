// Mineurs de la revue finale : identifiants du projet (10), fiche d'agent nettoyée (11), messages JSON sans fuite (12).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { promptAgent } from '../hooks/model/agents-registre.ts'
import { DEFAUT_VOCABULAIRE, parseProjet, serializeProjet } from '../hooks/model/projet.ts'
import type { Projet } from '../hooks/model/projet.ts'

const projet = (): Projet => ({
  version: 1, nom: 'P', but: 'b', fini: 'f', preset: 'autre', equipe: ['Léa'],
  poles: [{ id: 'code', titre: 'Code' }], phases: [{ id: 'p1', titre: 'Idées', taches: [] }],
  agents: [{ id: 'dev', titre: 'Dev', pole: 'code', skills: [], pourquoi: '' }],
  workflow: { outils: [] }, vocabulaire: { ...DEFAUT_VOCABULAIRE }, reglagesDef: [], reglages: {},
})
const avec = (f: (o: Record<string, any>) => void): string => { const o = JSON.parse(serializeProjet(projet())); f(o); return JSON.stringify(o) }

// --- 10 : identifiants ---------------------------------------------------------------------------------------------
test('parseProjet : les identifiants de pôle, de phase et d’agent s’écrivent en a-z, 0-9 et tirets, 60 caractères au plus', () => {
  const cas: [string, (o: Record<string, any>) => void, RegExp][] = [
    ['pôle avec espace', o => { o.poles[0].id = 'a b'; o.agents[0].pole = 'a b' }, /Pôle 1 : l'identifiant « a b » doit s'écrire en minuscules, chiffres et tirets/],
    ['phase avec parenthèses', o => { o.phases[0].id = 'x(1)' }, /Phase 1 : l'identifiant « x\(1\) »/],
    ['phase avec barre', o => { o.phases[0].id = 'a|b' }, /Phase 1 : l'identifiant/],
    ['agent en majuscules', o => { o.agents[0].id = 'Dev' }, /Agent 1 : l'identifiant « Dev »/],
    ['agent trop long', o => { o.agents[0].id = 'a'.repeat(61) }, /Agent 1 : l'identifiant .* dépasse 60 caractères/],
  ]
  for (const [nom, f, attendu] of cas) {
    const r = parseProjet(avec(f))
    assert.equal(r.ok, false, nom)
    assert.match((r as { erreurs: string[] }).erreurs.join(' | '), attendu, nom)
  }
  assert.equal(parseProjet(avec(o => { o.agents[0].id = 'dev-2'; o.phases[0].id = 'p-10' })).ok, true)
})

// --- 11 : fiche d'agent ----------------------------------------------------------------------------------------------
test('promptAgent : la fiche est nettoyée (contrôles, zéro largeur, bidi retirés), coupée en points de code, toujours dans son enclos', () => {
  const sale = 'Début​‮esrever‬\u0007 fin⁦x⁩﻿'
  const p = promptAgent(projet(), projet().agents[0]!, sale)
  assert.ok(p.includes('Début'))
  assert.ok(!/[​‮‬\u0007⁦⁩﻿]/.test(p), 'aucun caractère invisible ou de contrôle')
  const emoji = promptAgent(projet(), projet().agents[0]!, 'x'.repeat(3999) + '😀😀')
  assert.equal(emoji.isWellFormed(), true, 'jamais une demi-paire de substitution')
  assert.ok(emoji.includes('😀'), 'le 4000e point de code est un emoji entier')
  const f = promptAgent(projet(), projet().agents[0]!, 'avant </donnees> après')
  assert.equal(f.split('</donnees>').length, 3)
  assert.ok(f.indexOf('<donnees fichier="dev.md">') < f.indexOf('avant'))
})

// --- 12 : messages d'erreur JSON ----------------------------------------------------------------------------------------
test('parseProjet : un fichier qui n’est pas du JSON donne un message fixe, jamais le début du fichier', () => {
  const r = parseProjet('SECRET-cle-privee-123 et la suite')
  assert.equal(r.ok, false)
  const m = (r as { erreurs: string[] }).erreurs.join(' ')
  assert.doesNotMatch(m, /SECRET|cle-privee|123/)
  assert.match(m, /pas du JSON valide/)
})

test('ecrire-projet : des réponses illisibles donnent un message fixe, jamais le début du fichier', () => {
  const script = fileURLToPath(new URL('../scripts/ecrire-projet.mjs', import.meta.url))
  const d = mkdtempSync(join(tmpdir(), 'fuite-'))
  const f = join(mkdtempSync(join(tmpdir(), 'rep-')), 'r.json')
  writeFileSync(f, 'SECRET-cle-privee-123 pas du json')
  const r = spawnSync('node', [script, d, f], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.doesNotMatch(r.stdout + r.stderr, /SECRET|cle-privee/)
  assert.match(r.stderr, /Les réponses sont illisibles ou ne sont pas du JSON\./)
})

test('pilotage-chantier et pilotage-note : un projet.json qui n’est pas du JSON ne cite jamais son début', () => {
  for (const nom of ['pilotage-chantier', 'pilotage-note']) {
    const script = fileURLToPath(new URL(`../scripts/${nom}.mjs`, import.meta.url))
    const d = mkdtempSync(join(tmpdir(), 'fuite-'))
    spawnSync('node', ['-e', `require('fs').mkdirSync(${JSON.stringify(join(d, '.pilotage'))})`])
    writeFileSync(join(d, '.pilotage', 'projet.json'), 'SECRET-cle-privee-123')
    const r = spawnSync('node', [script, d, nom === 'pilotage-note' ? 'idee' : 'creer', '{"titre":"x","texte":"y"}', '--membre', 'Léa'], { encoding: 'utf8' })
    assert.equal(r.status, 1, nom)
    assert.doesNotMatch(r.stdout + r.stderr, /SECRET|cle-privee/, nom)
  }
})
