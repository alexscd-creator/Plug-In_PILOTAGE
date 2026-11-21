import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const racine = fileURLToPath(new URL('../hooks', import.meta.url))
const lire = d => readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? lire(`${d}/${e.name}`) : [`${d}/${e.name}`]))

test('les projets d’exemple de la maquette ne sont pas codés en dur dans hooks/', () => {
  const tout = lire(racine).map(f => readFileSync(f, 'utf8')).join('\n')
  for (const mot of ['Boutique de céramique', 'Obby des volcans']) assert.equal(tout.includes(mot), false, mot)
})
