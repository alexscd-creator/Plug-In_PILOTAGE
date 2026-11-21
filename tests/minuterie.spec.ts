import assert from 'node:assert/strict'
import { test } from 'node:test'

import { creerMinuterie } from '../hooks/model/minuterie.ts'
import type { Horloge } from '../hooks/model/minuterie.ts'

/** Fausse horloge : un `every` rend un Timer { cancel } ; un minuteur annulé ne tire plus jamais. */
function fausseHorloge() {
  const minuteurs: { fn: () => void; annule: boolean }[] = []
  const horloge: Horloge = {
    every(_ms, fn) {
      const m = { fn, annule: false }
      minuteurs.push(m)
      return { cancel: () => { m.annule = true } }
    },
  }
  return {
    horloge,
    creations: () => minuteurs.length,
    vivants: () => minuteurs.filter(m => !m.annule).length,
    /** Laisse passer une période : chaque minuteur vivant tire. */
    passer: () => { for (const m of minuteurs) if (!m.annule) m.fn() },
  }
}

test('un seul minuteur vivant, même après deux démarrages de suite', () => {
  const h = fausseHorloge()
  let ticks = 0
  const m = creerMinuterie(5000)
  m.demarrer(h.horloge, () => { ticks++ })
  m.demarrer(h.horloge, () => { ticks++ })
  assert.equal(h.vivants(), 1)
  assert.equal(h.creations(), 1)
  h.passer()
  assert.equal(ticks, 1)
})

test('arrêter annule vraiment le Timer : plus aucun tick', () => {
  const h = fausseHorloge()
  let ticks = 0
  const m = creerMinuterie(5000)
  m.demarrer(h.horloge, () => { ticks++ })
  m.arreter()
  assert.equal(h.vivants(), 0)
  h.passer()
  assert.equal(ticks, 0)
  assert.equal(m.tourne(), false)
})

test('valide → invalide → valide : exactement un minuteur vivant, aucun cumul', () => {
  const h = fausseHorloge()
  let ticks = 0
  const m = creerMinuterie(5000)
  for (let i = 0; i < 3; i++) {
    m.demarrer(h.horloge, () => { ticks++ })
    assert.equal(h.vivants(), 1)
    m.arreter()
    assert.equal(h.vivants(), 0)
    h.passer()
  }
  assert.equal(ticks, 0)
  m.demarrer(h.horloge, () => { ticks++ })
  assert.equal(h.vivants(), 1)
  h.passer()
  assert.equal(ticks, 1)
})

test('une horloge qui lève ou un cancel qui lève : jamais d’exception, le minuteur n’est pas compté', () => {
  const m = creerMinuterie(5000)
  m.demarrer({ every: () => { throw new Error('pas d’horloge') } }, () => undefined)
  assert.equal(m.tourne(), false)
  m.demarrer({ every: () => ({ cancel: () => { throw new Error('x') } }) }, () => undefined)
  assert.equal(m.tourne(), true)
  m.arreter()
  assert.equal(m.tourne(), false)
})
