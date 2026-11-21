import assert from 'node:assert/strict'
import { test } from 'node:test'

import { agentDeSousType, appelEnFond, classerResultat, cleDAppel, debutAppel, debutAttente, finAppel, finAttente, fusionnerEtats, LIVE_VIDE, nombreAppels } from '../hooks/model/agents-live.ts'
import type { Live } from '../hooks/model/agents-live.ts'
import type { Chantier } from '../hooks/model/chantier.ts'

const MIN = 60_000
const T0 = Date.parse('2026-11-21T10:00:00Z')
const iso = (ms: number): string => new Date(ms).toISOString()
const AGENTS = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]

const c = (id: string, extra: Partial<Chantier> = {}): Chantier => ({
  id, titre: `Chantier ${id}`, pole: 'code', phase: 'p1', etat: 'en-travail', session: '', agents: [], taches: [],
  fichiers: [], cree: iso(T0 - 60 * MIN), maj: iso(T0 - MIN), passation: '', archive: false, auteur: 'Léa', ...extra,
})

test('debutAppel puis finAppel ok : en cours pendant l’appel, puis « prêt » gardé', () => {
  const l1 = debutAppel(LIVE_VIDE, 'toolu_1', 'a1', 'Écrire le lobby', T0)
  assert.equal(nombreAppels(l1, 'a1'), 1)
  assert.deepEqual(l1.appels, [{ cle: 'toolu_1', agent: 'a1', quoi: 'Écrire le lobby', depuis: T0 }])
  assert.equal(LIVE_VIDE.appels.length, 0, 'l’état de départ n’est jamais modifié')
  const l2 = finAppel(l1, 'toolu_1', T0 + 5000, 'ok')
  assert.equal(nombreAppels(l2, 'a1'), 0)
  assert.deepEqual(l2.derniers, [{ agent: 'a1', etat: 'pret', quoi: 'Écrire le lobby', depuis: T0 + 5000 }])
  assert.equal(l1.appels.length, 1, 'l’ancien état n’est pas modifié')
})

test('finAppel en erreur : « bloqué »', () => {
  const l = finAppel(debutAppel(LIVE_VIDE, 'k', 'a1', 'x', T0), 'k', T0 + 1, 'erreur')
  assert.equal(l.derniers[0]!.etat, 'bloque')
})

test('deux appels en parallèle du même agent : il travaille tant qu’un appel dure, l’issue ne vient qu’avec le dernier', () => {
  let l: Live = debutAppel(LIVE_VIDE, 'k1', 'a1', 'Premier', T0)
  l = debutAppel(l, 'k2', 'a1', 'Second', T0 + 1000)
  assert.equal(nombreAppels(l, 'a1'), 2)
  l = finAppel(l, 'k1', T0 + 2000, 'erreur')
  assert.equal(nombreAppels(l, 'a1'), 1)
  assert.deepEqual(l.derniers, [], 'un appel dure encore : pas d’issue')
  assert.equal(fusionnerEtats(AGENTS, l, [], T0 + 3000)[0]!.etat, 'en-travail')
  l = finAppel(l, 'k2', T0 + 4000, 'ok')
  assert.equal(nombreAppels(l, 'a1'), 0)
  assert.deepEqual(l.derniers.map(d => [d.agent, d.etat]), [['a1', 'pret']])
})

test('un appel qui lève : l’issue « erreur » est prise en compte et l’appel disparaît', () => {
  const l = finAppel(debutAppel(LIVE_VIDE, 'k', 'a2', 'Plante', T0), 'k', T0 + 10, 'erreur')
  assert.equal(nombreAppels(l, 'a2'), 0)
  assert.equal(fusionnerEtats(AGENTS, l, [], T0 + 20)[1]!.etat, 'bloque')
})

test('finAppel d’une clé inconnue ou répétée : rien ne change (même objet)', () => {
  const l = debutAppel(LIVE_VIDE, 'k', 'a1', 'x', T0)
  assert.equal(finAppel(l, 'autre', T0, 'ok'), l)
  const fini = finAppel(l, 'k', T0 + 1, 'ok')
  assert.equal(finAppel(fini, 'k', T0 + 2, 'erreur'), fini)
})

test('debutAppel : clé déjà vue ou identifiant invalide ignorés, texte ramené à une ligne bornée', () => {
  const l = debutAppel(LIVE_VIDE, 'k', 'a1', 'x', T0)
  assert.equal(debutAppel(l, 'k', 'a2', 'y', T0 + 1), l)
  assert.equal(debutAppel(LIVE_VIDE, 'k', '', 'x', T0), LIVE_VIDE)
  assert.equal(debutAppel(LIVE_VIDE, 'k', '__proto__', 'x', T0), LIVE_VIDE)
  assert.equal(debutAppel(LIVE_VIDE, '', 'a1', 'x', T0), LIVE_VIDE)
  const long = debutAppel(LIVE_VIDE, 'k', 'a1', `ligne 1\n${'a|b'.repeat(200)}`, T0)
  assert.ok(!long.appels[0]!.quoi.includes('\n'))
  assert.ok(long.appels[0]!.quoi.length <= 200)
  assert.equal(debutAppel(LIVE_VIDE, 'k', 'a1', undefined as unknown as string, T0).appels[0]!.quoi, '')
})

test('un nouvel appel efface l’issue précédente de l’agent', () => {
  let l = finAppel(debutAppel(LIVE_VIDE, 'k1', 'a1', 'x', T0), 'k1', T0 + 1, 'erreur')
  assert.equal(l.derniers.length, 1)
  l = debutAppel(l, 'k2', 'a1', 'y', T0 + 2)
  assert.deepEqual(l.derniers, [])
})

test('agentDeSousType : préfixe de plugin retiré, agent hors projet ignoré', () => {
  assert.equal(agentDeSousType('a1', AGENTS), 'a1')
  assert.equal(agentDeSousType('pilotage:a2', AGENTS), 'a2')
  assert.equal(agentDeSousType('un-plugin:avec:a3', AGENTS), 'a3')
  assert.equal(agentDeSousType('autre', AGENTS), null)
  assert.equal(agentDeSousType('plugin:inconnu', AGENTS), null)
  assert.equal(agentDeSousType('general-purpose', AGENTS), null)
  assert.equal(agentDeSousType(undefined, AGENTS), null)
  assert.equal(agentDeSousType('', AGENTS), null)
  assert.equal(agentDeSousType(42, AGENTS), null)
  assert.equal(agentDeSousType('a1', undefined as never), null)
})

test('attentes : compte des questions en cours, jamais négatif', () => {
  let l = debutAttente(LIVE_VIDE, 'q1')
  l = debutAttente(l, 'q2')
  assert.deepEqual(l.attentes, ['q1', 'q2'])
  assert.equal(debutAttente(l, 'q1'), l)
  l = finAttente(l, 'q1')
  assert.deepEqual(l.attentes, ['q2'])
  assert.equal(finAttente(l, 'inconnue'), l)
  assert.deepEqual(finAttente(l, 'q2').attentes, [])
  assert.equal(debutAttente(LIVE_VIDE, ''), LIVE_VIDE)
})

test('fusionnerEtats : un état par agent du projet, dans l’ordre du projet, « arrêté » sans aucun signe', () => {
  const r = fusionnerEtats(AGENTS, LIVE_VIDE, [], T0)
  assert.deepEqual(r, AGENTS.map(a => ({ agent: a.id, etat: 'arrete', quoi: '', depuis: null, source: 'aucune' })))
})

test('fusionnerEtats : appel en cours = en travail, source live, depuis le plus ancien appel', () => {
  let l = debutAppel(LIVE_VIDE, 'k2', 'a2', 'Plus tard', T0 - 1000)
  l = debutAppel(l, 'k1', 'a2', 'Plus tôt', T0 - 5000)
  const r = fusionnerEtats(AGENTS, l, [], T0)
  assert.deepEqual(r[1], { agent: 'a2', etat: 'en-travail', quoi: 'Plus tard', depuis: T0 - 5000, source: 'live' })
  assert.equal(r[0]!.source, 'aucune')
})

test('fusionnerEtats : le live en cours l’emporte sur la fiche, même fraîche et bloquée', () => {
  const fiche = c('x', { agents: [{ id: 'a1', etat: 'bloque', quoi: 'Vieux souci' }] })
  const l = debutAppel(LIVE_VIDE, 'k', 'a1', 'Reprise', T0)
  const e = fusionnerEtats(AGENTS, l, [fiche], T0)[0]!
  assert.equal(e.etat, 'en-travail')
  assert.equal(e.source, 'live')
  assert.equal(e.quoi, 'Reprise')
})

test('fusionnerEtats : sans appel, la fiche la plus fraîche d’un chantier non archivé', () => {
  const vieille = c('vieille', { maj: iso(T0 - 8 * MIN), agents: [{ id: 'a1', etat: 'pret', quoi: 'Ancien' }] })
  const fraiche = c('fraiche', { maj: iso(T0 - 2 * MIN), agents: [{ id: 'a1', etat: 'bloque', quoi: 'Récent' }] })
  const archivee = c('archivee', { archive: true, maj: iso(T0 - MIN), agents: [{ id: 'a1', etat: 'en-travail', quoi: 'Archive' }] })
  const e = fusionnerEtats(AGENTS, LIVE_VIDE, [vieille, archivee, fraiche], T0)[0]!
  assert.deepEqual(e, { agent: 'a1', etat: 'bloque', quoi: 'Récent', depuis: T0 - 2 * MIN, source: 'fiche' })
})

test('fusionnerEtats : règle des 15 minutes (en travail ou en attente anciens = prêt à reprendre ; autres états gardés)', () => {
  const ancien = iso(T0 - 20 * MIN)
  const f = c('x', {
    maj: ancien,
    agents: [
      { id: 'a1', etat: 'en-travail', quoi: 'Vieux travail' },
      { id: 'a2', etat: 'attente', quoi: 'Vieille question' },
      { id: 'a3', etat: 'bloque', quoi: 'Bloqué' },
    ],
  })
  const r = fusionnerEtats(AGENTS, LIVE_VIDE, [f], T0)
  assert.deepEqual(r.map(e => e.etat), ['pret', 'pret', 'bloque'])
  assert.ok(r.every(e => e.source === 'fiche'))
  const frais = fusionnerEtats(AGENTS, LIVE_VIDE, [{ ...f, maj: iso(T0 - 14 * MIN) }], T0)
  assert.deepEqual(frais.map(e => e.etat), ['en-travail', 'attente', 'bloque'])
})

test('fusionnerEtats : « attente » ne vient que des fiches (le live n’en pose pas pour un agent)', () => {
  const l = debutAttente(LIVE_VIDE, 'q')
  assert.equal(fusionnerEtats(AGENTS, l, [], T0)[0]!.etat, 'arrete')
  const f = c('x', { agents: [{ id: 'a1', etat: 'attente', quoi: 'Demande un choix' }] })
  const e = fusionnerEtats(AGENTS, l, [f], T0)[0]!
  assert.equal(e.etat, 'attente')
  assert.equal(e.source, 'fiche')
})

test('fusionnerEtats : issue live récente contre fiche — la plus fraîche gagne, le live à égalité', () => {
  const f = c('x', { maj: iso(T0 - 3 * MIN), agents: [{ id: 'a1', etat: 'en-travail', quoi: 'Fiche' }] })
  const l = finAppel(debutAppel(LIVE_VIDE, 'k', 'a1', 'Live', T0 - 5 * MIN), 'k', T0 - MIN, 'ok')
  const e = fusionnerEtats(AGENTS, l, [f], T0)[0]!
  assert.deepEqual(e, { agent: 'a1', etat: 'pret', quoi: 'Live', depuis: T0 - MIN, source: 'live' })
  const l2 = finAppel(debutAppel(LIVE_VIDE, 'k', 'a1', 'Live', T0 - 9 * MIN), 'k', T0 - 5 * MIN, 'ok')
  assert.equal(fusionnerEtats(AGENTS, l2, [f], T0)[0]!.source, 'fiche')
})

test('fusionnerEtats : agent d’une fiche absent du projet ignoré, entrées invalides sans levée', () => {
  const f = c('x', { agents: [{ id: 'hors-projet', etat: 'en-travail', quoi: '' }] })
  const r = fusionnerEtats(AGENTS, LIVE_VIDE, [f], T0)
  assert.equal(r.length, 3)
  assert.ok(r.every(e => e.source === 'aucune'))
  assert.deepEqual(fusionnerEtats(AGENTS, undefined as never, undefined as never, T0).map(e => e.etat), ['arrete', 'arrete', 'arrete'])
  assert.deepEqual(fusionnerEtats(undefined as never, LIVE_VIDE, [], T0), [])
  const sansDate = c('y', { maj: 'illisible', agents: [{ id: 'a1', etat: 'en-travail', quoi: 'q' }] })
  const e = fusionnerEtats(AGENTS, LIVE_VIDE, [sansDate], NaN)[0]!
  assert.equal(e.etat, 'en-travail')
  assert.equal(e.depuis, null)
})

test('agentDeSousType : avec le nom du plugin, seul son propre préfixe (ou aucun) est accepté', () => {
  assert.equal(agentDeSousType('pilotage:a1', AGENTS, 'pilotage'), 'a1')
  assert.equal(agentDeSousType('a1', AGENTS, 'pilotage'), 'a1')
  assert.equal(agentDeSousType('autre-plugin:a1', AGENTS, 'pilotage'), null)
  assert.equal(agentDeSousType('x:pilotage:a1', AGENTS, 'pilotage'), null)
  assert.equal(agentDeSousType('autre-plugin:a1', AGENTS, ''), 'a1', 'nom inconnu : tout préfixe est retiré, seuls les agents du projet comptent')
  assert.equal(agentDeSousType('autre-plugin:a1', AGENTS, undefined), 'a1')
  assert.equal(agentDeSousType('pilotage:inconnu', AGENTS, 'pilotage'), null)
})

test('cleDAppel : l’identifiant de l’appel, vide si absent ou illisible (alors aucun suivi)', () => {
  assert.equal(cleDAppel({ tool_use_id: 'toolu_1' }), 'toolu_1')
  for (const e of [undefined, null, 'x', 42, {}, { tool_use_id: '' }, { tool_use_id: 7 }, { tool_use_id: null }]) assert.equal(cleDAppel(e), '')
})

test('classerResultat : erreur si refus ou isError ; tout le reste (rien, texte, objet vide) = ok, sans lever', () => {
  assert.equal(classerResultat({ result: 'x' }), 'ok')
  assert.equal(classerResultat({ deny: 'non' }), 'erreur')
  assert.equal(classerResultat({ result: 'x', isError: true }), 'erreur')
  for (const r of [undefined, null, 'texte', 3, {}, []]) assert.equal(classerResultat(r), 'ok')
  const piege = { get deny(): string { throw new Error('piège') } }
  assert.equal(classerResultat(piege), 'ok')
})

test('appelEnFond : run_in_background ou isolation distante', () => {
  assert.equal(appelEnFond({ run_in_background: true }), true)
  assert.equal(appelEnFond({ isolation: 'remote' }), true)
  for (const e of [undefined, null, {}, { run_in_background: false }, { run_in_background: 'true' }, { isolation: 'worktree' }, 'x']) assert.equal(appelEnFond(e), false)
})
