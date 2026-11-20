import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../scripts/lint-plugin.mjs', import.meta.url))

test('un plugin vide passe le lint', () => {
  const r = spawnSync('node', [script, mkdtempSync(join(tmpdir(), 'lint-'))], { encoding: 'utf8' })
  assert.equal(r.status, 0)
})
