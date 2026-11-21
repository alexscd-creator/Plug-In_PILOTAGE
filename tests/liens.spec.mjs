// Liens et jonctions sous `.pilotage` : les scripts n'écrivent jamais au travers d'un lien qui mène hors du projet.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { CheminNonSur, verifierChemin } from '../scripts/lib/ecriture.mjs'

const ecrireProjet = fileURLToPath(new URL('../scripts/ecrire-projet.mjs', import.meta.url))
const chantier = fileURLToPath(new URL('../scripts/pilotage-chantier.mjs', import.meta.url))
const note = fileURLToPath(new URL('../scripts/pilotage-note.mjs', import.meta.url))
const node = (...a) => spawnSync('node', a, { encoding: 'utf8' })

const reponses = {
  nom: 'Mon projet', but: 'Un but', fini: 'Publié', preset: 'autre', equipe: ['Léa Dupont'],
  poles: [{ id: 'technique', titre: 'Technique' }], phases: [{ id: 'dev', titre: 'Dév', taches: [] }],
  agents: [{ id: 'dev', titre: 'Développeur', pole: 'technique', skills: [], pourquoi: 'Code' }],
  workflow: { outils: [{ role: 'IA', outil: 'Claude' }] },
}
const fichierReponses = () => {
  const f = join(mkdtempSync(join(tmpdir(), 'rep-')), 'r.json')
  writeFileSync(f, JSON.stringify(reponses))
  return f
}
function projet() {
  const d = mkdtempSync(join(tmpdir(), 'liens-'))
  const r = node(ecrireProjet, d, fichierReponses())
  assert.equal(r.status, 0, r.stderr)
  return d
}
/** Un lien de dossier (jonction sous Windows) ; null si le système le refuse. */
function lier(cible, chemin) {
  try {
    symlinkSync(cible, chemin, process.platform === 'win32' ? 'junction' : 'dir')
    return true
  } catch {
    return null
  }
}
const vide = d => readdirSync(d, { recursive: true }).length === 0
const peutLier = (() => {
  const a = mkdtempSync(join(tmpdir(), 'essai-lien-'))
  mkdirSync(join(a, 'cible'))
  return lier(join(a, 'cible'), join(a, 'lien')) === true
})()
const SANS_LIEN = peutLier ? false : 'ce système refuse de créer un lien de dossier : le test réel est sauté (le contrôle reste testé avec un faux disque)'

test('dossier du membre remplacé par une jonction vers l’extérieur : creer, porte et note refusés (code 1), rien n’est écrit dehors', { skip: SANS_LIEN }, () => {
  const d = projet()
  const dehors = mkdtempSync(join(tmpdir(), 'dehors-'))
  const membre = join(d, '.pilotage', 'equipe', 'lea-dupont')
  rmSync(membre, { recursive: true, force: true })
  assert.ok(lier(dehors, membre))
  for (const r of [
    node(chantier, d, 'creer', JSON.stringify({ titre: 'Evasion' }), '--membre', 'Léa Dupont'),
    node(chantier, d, 'porte', JSON.stringify({ phase: 'dev', mode: 'repondre', note: 'x' }), '--membre', 'Léa Dupont', '--confirme'),
    node(note, d, 'idee', JSON.stringify({ titre: 'T', texte: 'x' }), '--membre', 'Léa Dupont'),
  ]) {
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stderr, /Chemin non sûr \(lien hors du projet\)/)
  }
  assert.ok(vide(dehors), readdirSync(dehors, { recursive: true }).join(', '))
})

test('.pilotage entier déplacé dehors et remplacé par une jonction : les scripts refusent d’écrire (code 1)', { skip: SANS_LIEN }, () => {
  const d = projet()
  const dehors = join(mkdtempSync(join(tmpdir(), 'dehors-')), 'p')
  cpSync(join(d, '.pilotage'), dehors, { recursive: true })
  rmSync(join(d, '.pilotage'), { recursive: true, force: true })
  assert.ok(lier(dehors, join(d, '.pilotage')))
  const avant = readdirSync(dehors, { recursive: true }).map(String).sort()
  for (const r of [
    node(chantier, d, 'creer', JSON.stringify({ titre: 'Evasion' }), '--membre', 'Léa Dupont'),
    node(note, d, 'feedback', JSON.stringify({ titre: 'T', texte: 'x' }), '--membre', 'Léa Dupont'),
  ]) {
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stderr, /Chemin non sûr/)
  }
  assert.deepEqual(readdirSync(dehors, { recursive: true }).map(String).sort(), avant)
})

test('ecrire-projet : un .pilotage qui est une jonction vers l’extérieur est refusé (code 1), rien n’est écrit dehors', { skip: SANS_LIEN }, () => {
  const d = mkdtempSync(join(tmpdir(), 'liens-neuf-'))
  const dehors = mkdtempSync(join(tmpdir(), 'dehors-'))
  assert.ok(lier(dehors, join(d, '.pilotage')))
  const r = node(ecrireProjet, d, fichierReponses())
  assert.equal(r.status, 1, r.stdout + r.stderr)
  assert.match(r.stderr, /Chemin non sûr/)
  assert.ok(vide(dehors))
})

test('une jonction qui reste DANS le projet est acceptée (le chemin réel reste sous la racine)', { skip: SANS_LIEN }, () => {
  const d = projet()
  const membre = join(d, '.pilotage', 'equipe', 'lea-dupont')
  const vrai = join(d, 'vrai-dossier')
  renameSync(membre, vrai)
  assert.ok(lier(vrai, membre))
  const r = node(chantier, d, 'creer', JSON.stringify({ titre: 'Dedans' }), '--membre', 'Léa Dupont')
  assert.equal(r.status, 0, r.stderr)
  assert.ok(existsSync(join(vrai, 'chantiers', 'dedans.md')))
})

// --- le contrôle seul, avec un faux disque (toujours joué, même sans droit de créer des liens) --------------------------

const ab = (...p) => join(process.platform === 'win32' ? 'C:\\' : '/', ...p)
const R = ab('P')
const faux = (reels, absents = []) => ({
  realpathSync: p => { if (absents.includes(p)) throw Object.assign(new Error('x'), { code: 'ENOENT' }); return reels[p] ?? p },
  lstatSync: p => { if (absents.includes(p)) throw Object.assign(new Error('x'), { code: 'ENOENT' }); return {} },
})

test('verifierChemin : chaque morceau existant du chemin doit rester sous la racine réelle', () => {
  const cible = join(R, '.pilotage', 'equipe', 'lea', 'chantiers', 'a.md')
  assert.doesNotThrow(() => verifierChemin(R, cible, faux({})))
  // `equipe/lea` mène dehors
  assert.throws(() => verifierChemin(R, cible, faux({ [join(R, '.pilotage', 'equipe', 'lea')]: ab('Users', 'x', '.claude') })), CheminNonSur)
  // `.pilotage` mène dehors
  assert.throws(() => verifierChemin(R, cible, faux({ [join(R, '.pilotage')]: ab('ailleurs') })), CheminNonSur)
  // un dossier voisin au nom proche (C:\P2) n'est pas « sous » C:\P
  assert.throws(() => verifierChemin(R, cible, faux({ [join(R, '.pilotage')]: ab('P2', '.pilotage') })), CheminNonSur)
  // la suite n'existe pas encore : rien à suivre, accepté
  assert.doesNotThrow(() => verifierChemin(R, cible, faux({}, [join(R, '.pilotage', 'equipe', 'lea', 'chantiers')])))
  // un lien cassé (lstat oui, realpath non) : refusé
  const casse = join(R, '.pilotage', 'equipe', 'lea')
  assert.throws(() => verifierChemin(R, cible, { lstatSync: () => ({}), realpathSync: p => { if (p === casse) throw new Error('ENOENT'); return p } }), CheminNonSur)
  // une cible hors de la racine : refusée
  assert.throws(() => verifierChemin(R, ab('Autre', 'x.md'), faux({})), CheminNonSur)
})
