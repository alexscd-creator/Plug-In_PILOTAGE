import type { Register } from 'claude-code'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pilotage',
      description: 'Ouvre le panneau Pilotage (chantiers, idées, suivi)',
    })
    return next(e)
  })

  on('command.run', { command: 'pilotage' }, async () => ({ text: 'Pilotage installé' }))
}
