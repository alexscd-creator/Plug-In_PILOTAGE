import assert from 'node:assert/strict'
import { test } from 'node:test'

import { contraste, couleurPole, ESPACES, ETATS, jetons, LIBELLES_ETAT, RAYONS, TEINTES, TYPO } from '../hooks/ui/theme.ts'
import { GLYPHES, icone, NOMS_ICONES, tracer } from '../hooks/ui/icones.ts'

test('les jetons clair et sombre sont ceux de la maquette et diffèrent', () => {
  const c = jetons('clair'), s = jetons('sombre')
  assert.equal(c.fond, '#f6f7fa'); assert.equal(s.fond, '#0d0e12')
  assert.equal(c.surface, '#ffffff'); assert.equal(s.surface, '#13151b')
  assert.equal(c.accent, '#4f56e0'); assert.equal(s.accent, '#8b93ff')
  assert.equal(c.texte, '#13151b'); assert.equal(s.texte, '#eceef5')
  assert.equal(c.bord, '#d9dde8'); assert.equal(s.bord, '#2b303d')
  assert.notEqual(c.accentSoft, s.accentSoft)
})

test('les six états : couleurs, libellés exacts et icônes de la maquette', () => {
  assert.deepEqual(ETATS, ['travail', 'attente', 'arrete', 'reprendre', 'bloque', 'termine'])
  assert.deepEqual(LIBELLES_ETAT, {
    travail: 'En travail', attente: 'En attente d’une réponse', arrete: 'Arrêté',
    reprendre: 'Prêt à reprendre', bloque: 'Bloqué', termine: 'Terminé',
  })
  assert.equal(jetons('clair').etats.travail.fg, '#1d64b8')
  assert.equal(jetons('sombre').etats.bloque.fg, '#ff8a80')
  assert.equal(jetons('clair').etats.termine.icone, 'termine')
  assert.equal(jetons('clair').etats.travail.icone, 'play')
  assert.equal(jetons('clair').etats.attente.icone, 'attente')
  assert.equal(jetons('clair').etats.arrete.icone, 'stop')
  assert.equal(jetons('clair').etats.reprendre.icone, 'reprendre')
  assert.equal(jetons('clair').etats.bloque.icone, 'bloque')
})

test('palette de pôles : six teintes, hex de la maquette, texte lisible (AA) sur la teinte douce', () => {
  assert.deepEqual(TEINTES, ['violet', 'bleu', 'sarcelle', 'vert', 'orange', 'rose'])
  assert.equal(jetons('clair').poles.violet.fg, '#6b46c1')
  assert.equal(jetons('sombre').poles.rose.fg, '#ff8cc0')
  for (const mode of ['clair', 'sombre'] as const) {
    const j = jetons(mode)
    for (const t of TEINTES) assert.ok(contraste(j.poles[t].fg, j.poles[t].soft) >= 4.5, `${mode} ${t}`)
    for (const e of ETATS) assert.ok(contraste(j.etats[e].fg, j.etats[e].soft) >= 4.5, `${mode} ${e}`)
    assert.ok(contraste(j.texte, j.fond) >= 7)
    assert.ok(contraste(j.accent, j.accentSoft) >= 4.5, `${mode} accent`)
  }
})

test('couleurPole : la couleur du pôle, sinon la teinte du rang, sans doublon sur six pôles', () => {
  assert.equal(couleurPole('orange', 0), 'orange')
  assert.equal(couleurPole(undefined, 1), 'bleu')
  assert.equal(couleurPole('inconnue', 2), 'sarcelle')
  assert.equal(couleurPole(undefined, 7), 'bleu')
  assert.equal(new Set([0, 1, 2, 3, 4, 5].map(i => couleurPole(undefined, i))).size, 6)
})

test('espacements, rayons et typographie de la maquette', () => {
  assert.deepEqual(ESPACES, { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48, '4xl': 64 })
  assert.deepEqual(RAYONS, { sm: 6, md: 10, lg: 16, xl: 20, full: 999 })
  assert.equal(TYPO.titreEcran.taille, 28); assert.equal(TYPO.corps.taille, 15)
  assert.equal(TYPO.libelle.taille, 13); assert.equal(TYPO.legende.taille, 12); assert.equal(TYPO.surtitre.taille, 11)
})

test('icônes : les 43 de la maquette, un tracé et un repli texte chacune', () => {
  assert.equal(NOMS_ICONES.length, 43)
  assert.equal(new Set(NOMS_ICONES).size, 43)
  for (const n of NOMS_ICONES) {
    assert.ok(tracer(n).length > 5, n)
    assert.ok(GLYPHES[n] && GLYPHES[n].length > 0, n)
    const svg = icone(n, '#123456', 14)
    assert.match(svg, /^<svg /); assert.match(svg, /stroke="#123456"/); assert.match(svg, /width="14"/)
    assert.doesNotMatch(svg, /<text|<script/)
  }
})
