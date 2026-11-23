import assert from 'node:assert/strict'
import { test } from 'node:test'

import { RAPPEL_TRI, ressembleIdeeOuRetour } from '../hooks/model/detecteur.ts'

test('vrai pour une idée ou un retour, sans accent ni casse', () => {
  for (const t of [
    'Et si on ajoutait un mode sombre ?', 'Ce serait bien de pouvoir trier les notes', 'il faudrait un export PDF',
    "J'aimerais voir les dépendances", 'J’aimerais un bouton de plus', 'ça ne marche pas quand je clique', 'Ca marche pas',
    'petit bug sur la page Plan', 'Retour : le menu est confus', 'Une idée : un mode hors ligne', 'le titre est trop petit',
    'ce serait mieux avec des icônes', 'on pourrait ajouter un filtre',
  ]) assert.ok(ressembleIdeeOuRetour(t), t)
})

test('faux pour une commande, une réponse courte ou une question simple', () => {
  for (const t of ['/projet', '/pilotage:chantier et si on ajoutait', 'ok', 'Oui, créer', '1', 'yes', 'Où en est la phase ?', 'merci', '', '   ']) {
    assert.ok(!ressembleIdeeOuRetour(t), t)
  }
})

test('ne lève jamais sur une entrée étrange', () => {
  for (const t of [undefined, null, 3, {}, 'x'.repeat(100000)] as unknown[]) assert.equal(typeof ressembleIdeeOuRetour(t as string), 'boolean')
})

test('le rappel nomme le skill chef-de-projet et ne décide rien', () => {
  assert.match(RAPPEL_TRI, /chef-de-projet/)
  assert.match(RAPPEL_TRI, /idée ou (à )?un retour/)
  assert.ok(RAPPEL_TRI.length < 300)
})
