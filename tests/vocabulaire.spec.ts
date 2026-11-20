import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parsePreset, preparerProjet, libelle } from '../hooks/model/presets.ts'
import type { Preset } from '../hooks/model/presets.ts'
import { parseProjet, serializeProjet } from '../hooks/model/projet.ts'

const texte = (id: string): string => readFileSync(fileURLToPath(new URL(`../presets/${id}.json`, import.meta.url)), 'utf8')
const charger = (id: string): Preset => {
  const p = parsePreset(texte(id))
  assert.ok(p, id)
  return p
}
const reponses = { nom: 'N', but: 'B', fini: 'F', equipe: ['Léa'] }

test('site-web : vocabulaire de la maquette', () => {
  assert.deepEqual(charger('site-web').vocabulaire, {
    type: 'Site web', nomDuProjet: 'Nom du site', leProjet: 'le site', unProjet: 'un site',
    objectif: 'Objectif du site', fini: 'Ce que « en ligne » veut dire',
  })
})

test('jeu-roblox, application, autre : vocabulaire', () => {
  assert.equal(charger('jeu-roblox').vocabulaire.type, 'Jeu Roblox')
  assert.equal(charger('jeu-roblox').vocabulaire.nomDuProjet, 'Nom du jeu')
  assert.equal(charger('application').vocabulaire.type, 'Application')
  assert.equal(charger('application').vocabulaire.nomDuProjet, "Nom de l'application")
  assert.deepEqual(charger('autre').vocabulaire, {
    type: 'Projet', nomDuProjet: 'Nom du projet', leProjet: 'le projet', unProjet: 'un projet',
    objectif: 'Objectif du projet', fini: 'Ce que « fini » veut dire',
  })
})

test('autre : aucun réglage propre au type', () => {
  assert.deepEqual(charger('autre').reglagesDef, [])
})

const resume = (id: string) => charger(id).reglagesDef.map(d => [d.id, d.libelle, d.genre, d.options ?? null, d.defaut ?? null])

test('site-web : réglages de la maquette (Domaine, Hébergement, Paiement en ligne)', () => {
  assert.deepEqual(resume('site-web'), [
    ['domaine', 'Domaine', 'texte', null, null],
    ['hebergement', 'Hébergement', 'choix', ['à choisir', 'mutualisé', 'cloud', 'statique'], 'à choisir'],
    ['paiement-en-ligne', 'Paiement en ligne', 'oui-non', null, false],
  ])
})

test('jeu-roblox : réglages de la maquette (connexion, modération et charte joueur, public visé)', () => {
  assert.deepEqual(resume('jeu-roblox'), [
    ['connexion-roblox-studio', 'Connexion à Roblox Studio', 'oui-non', null, false],
    ['moderation-et-charte-joueur', 'Modération et charte joueur', 'oui-non', null, true],
    ['public-vise', 'Public visé', 'choix', ['tout public', '10 ans et plus', '13 ans et plus'], 'tout public'],
  ])
})

test('application : réglages de la maquette (Plateformes, Publication)', () => {
  assert.deepEqual(resume('application'), [
    ['plateformes', 'Plateformes', 'choix', ['web', 'mobile', 'bureau'], 'web'],
    ['publication', 'Publication', 'choix', ['à définir', "magasin d'applications", 'site web', 'interne'], 'à définir'],
  ])
})

test('preparerProjet copie vocabulaire et définitions, amorce reglages avec les défauts, sans lier au preset', () => {
  const preset = charger('jeu-roblox')
  const p = preparerProjet(preset, reponses)
  assert.deepEqual(p.vocabulaire, preset.vocabulaire)
  assert.deepEqual(p.reglagesDef, preset.reglagesDef)
  assert.deepEqual(p.reglages, { 'connexion-roblox-studio': false, 'moderation-et-charte-joueur': true, 'public-vise': 'tout public' })
  p.vocabulaire.type = 'X'; p.reglagesDef[0]!.libelle = 'X'; p.reglages['public-vise'] = 'x'
  assert.equal(preset.vocabulaire.type, 'Jeu Roblox')
  assert.equal(preset.reglagesDef[0]!.libelle, 'Connexion à Roblox Studio')
  const site = charger('site-web')
  const q = preparerProjet(site, reponses)
  q.reglagesDef[1]!.options!.push('x')
  assert.equal(site.reglagesDef[1]!.options!.length, 4)
})

test('chaque preset donne un projet qui fait l\'aller-retour', () => {
  for (const id of ['site-web', 'jeu-roblox', 'application', 'autre']) {
    const p = preparerProjet(charger(id), reponses)
    const r = parseProjet(serializeProjet(p))
    assert.ok(r.ok, id + (r.ok ? '' : r.erreurs.join(' / ')))
    if (r.ok) assert.deepEqual(r.projet, p)
  }
})

test('libelle suit le type de projet', () => {
  const site = preparerProjet(charger('site-web'), reponses)
  const jeu = preparerProjet(charger('jeu-roblox'), reponses)
  assert.equal(libelle(site, 'nomDuProjet'), 'Nom du site')
  assert.equal(libelle(jeu, 'nomDuProjet'), 'Nom du jeu')
  assert.equal(libelle(site, 'leProjet'), 'le site')
  assert.equal(libelle(site, 'fini'), 'Ce que « en ligne » veut dire')
})

test('parsePreset refuse un vocabulaire ou des réglages invalides', () => {
  const base = JSON.parse(texte('site-web'))
  assert.equal(parsePreset(JSON.stringify({ ...base, vocabulaire: { type: '' } })), null)
  assert.equal(parsePreset(JSON.stringify({ ...base, reglagesDef: [{ id: 'A b', libelle: 'x', genre: 'texte' }] })), null)
})

test('un preset sans vocabulaire (ancien) prend le défaut neutre', () => {
  const { vocabulaire, reglagesDef, ...ancien } = JSON.parse(texte('autre'))
  void vocabulaire; void reglagesDef
  const p = parsePreset(JSON.stringify(ancien))
  assert.ok(p)
  assert.equal(p.vocabulaire.nomDuProjet, 'Nom du projet')
  assert.deepEqual(p.reglagesDef, [])
})
