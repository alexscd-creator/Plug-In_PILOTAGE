import { expect, test } from 'claude-code/testing'

import { disque } from './disque'

test('la commande pilotage est enregistrée et répond', async ($, on) => {
  disque(on, {})
  const enregistrees: string[] = []
  on('command.register', (_: unknown, e: { name: string }) => {
    enregistrees.push(e.name)
    return { value: undefined }
  })
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: 'C:/Projet', surface: 'terminal', isInteractive: true })
  expect(enregistrees).toEqual(['pilotage'])
  const r = await $.command.run({ command: 'pilotage' })
  expect(r.text).toMatch(/Aucun projet/)
})
