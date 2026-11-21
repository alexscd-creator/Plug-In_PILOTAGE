// Une seule règle pour le dossier d'un membre (`.pilotage/equipe/<dossier>`) : la même dans les scripts qui écrivent et dans le panneau qui lit,
// y compris pour les lettres que NFD ne décompose pas (Ø, Ł, Æ, Œ, ß, Đ, Ð, Þ, ı).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dossierMembre, memeMembre, plier } from '../hooks/model/projet.ts'
import { lireProjetComplet } from '../hooks/model/lecture.ts'

const ecrireProjet = fileURLToPath(new URL('../scripts/ecrire-projet.mjs', import.meta.url))
const chantier = fileURLToPath(new URL('../scripts/pilotage-chantier.mjs', import.meta.url))
const note = fileURLToPath(new URL('../scripts/pilotage-note.mjs', import.meta.url))
const node = (...a) => spawnSync('node', a, { encoding: 'utf8' })

test('plier et dossierMembre : accents retirés, lettres non décomposables remplacées, puis a-z 0-9 et tirets', () => {
  const cas = { 'Ølaf': 'olaf', 'Łukasz': 'lukasz', 'Æsa': 'aesa', 'Œdipe': 'oedipe', 'Strauß': 'strauss', 'Đorđe': 'dorde', 'Ðana': 'dana', 'Þór': 'thor', 'Işık': 'isik', 'Léa Dupont': 'lea-dupont', 'Jean-Luc': 'jean-luc', 'Zoë': 'zoe' }
  for (const [prenom, dossier] of Object.entries(cas)) assert.equal(dossierMembre(prenom), dossier, prenom)
  assert.equal(plier('ØŁÆŒẞĐÐÞ'), 'olaeoessddth')
})

test('memeMembre suit la même règle : un prénom et son dossier désignent toujours le même membre', () => {
  for (const p of ['Ølaf', 'Łukasz', 'Æsa', 'Œdipe', 'Strauß', 'Þór', 'Léa Dupont', 'Jean_Luc2']) assert.ok(memeMembre(p, dossierMembre(p)), p)
  assert.ok(memeMembre('Ølaf', 'olaf') && memeMembre('Łukasz', 'LUKASZ'))
  assert.ok(!memeMembre('Ølaf', 'laf'))
  assert.ok(!memeMembre('李', '王'), 'deux prénoms sans lettre latine restent distincts')
  assert.ok(memeMembre('李', '李'))
})

const reponses = equipe => ({
  nom: 'P', but: 'b', fini: 'f', preset: 'autre', equipe,
  poles: [{ id: 'technique', titre: 'Technique' }], phases: [{ id: 'dev', titre: 'Dév', taches: [] }],
  agents: [], workflow: { outils: [{ role: 'IA', outil: 'Claude' }] },
})
function projet(equipe) {
  const d = mkdtempSync(join(tmpdir(), 'norme-'))
  const f = join(mkdtempSync(join(tmpdir(), 'rep-')), 'r.json')
  writeFileSync(f, JSON.stringify(reponses(equipe)))
  const r = node(ecrireProjet, d, f)
  return { d, r }
}

test('ecrire-projet, pilotage-chantier, pilotage-note et la lecture du panneau : Ølaf et Łukasz ont le même dossier partout', async () => {
  const { d, r } = projet(['Ølaf', 'Łukasz'])
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(readdirSync(join(d, '.pilotage', 'equipe')).sort(), ['lukasz', 'olaf'])
  const c = node(chantier, d, 'creer', JSON.stringify({ titre: 'Carte' }), '--membre', 'Ølaf')
  assert.equal(c.status, 0, c.stderr)
  assert.ok(existsSync(join(d, '.pilotage', 'equipe', 'olaf', 'chantiers', 'carte.md')))
  const p = node(chantier, d, 'porte', JSON.stringify({ phase: 'dev', mode: 'valider' }), '--membre', 'Łukasz')
  assert.equal(p.status, 0, p.stderr)
  const n = node(note, d, 'idee', JSON.stringify({ titre: 'Idée', texte: 'x' }), '--membre', 'lukasz')
  assert.equal(n.status, 0, n.stderr)
  assert.equal(readdirSync(join(d, '.pilotage', 'equipe', 'lukasz', 'idees')).length, 1)

  const fs = {
    read: async f => readFileSync(f, 'utf8'),
    list: async dir => readdirSync(dir),
  }
  const l = await lireProjetComplet(fs, d, 'Ølaf')
  assert.equal(l.chantiers.length, 1)
  assert.equal(l.chantiers[0].auteur, 'Ølaf')
  assert.deepEqual(l.portes['Łukasz'].valides, ['dev'], 'les portes de Łukasz (equipe/lukasz/portes.md) sont lues')
})

test('ecrire-projet refuse un prénom dont des lettres se perdraient dans le nom de dossier', () => {
  const { d, r } = projet(['Anna李', 'Sam'])
  assert.equal(r.status, 1, r.stdout + r.stderr)
  assert.match(r.stderr, /Anna李/)
  assert.ok(!existsSync(join(d, '.pilotage')))
})
