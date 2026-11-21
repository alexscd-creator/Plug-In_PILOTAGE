import { disque, HOME } from './disque'

export const TOUTES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
export const PROJET = {
  version: 1, nom: 'Mon projet', but: 'Un but', fini: 'Fini', preset: 'site-web', equipe: ['Léa', 'Sam'],
  poles: [{ id: 'code', titre: 'Code', couleur: 'bleu' }], phases: [{ id: 'p1', titre: 'Idées', taches: ['a'] }],
  agents: [], workflow: { outils: [] },
  vocabulaire: { type: 'Site web', nomDuProjet: 'Nom du site', leProjet: 'le site', unProjet: 'un site', objectif: 'Objectif du site', fini: 'Fini ?' },
}
export const PLAN = '## Idées (p1)\n\n- [ ] p1-1 | Faire a\n'
export const CONFIG_LEA = `${HOME}/.claude/pilotage/config.json`

/** Socle simulé : commande, cwd, prompt, ouverture de panneau, disque, états et écritures comptées. */
export function banc(on: Function, fichiers: Record<string, string>, cwd = 'C:/Projet') {
  const lus: string[] = []
  disque(on, fichiers, false, lus)
  const ecritures: string[] = []
  on('fs.write', (_: unknown, e: { path: string }) => { ecritures.push(e.path); return { value: undefined } })
  on('command.register', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: cwd }))
  on('prompt.compose', () => ({ sections: [] }))
  const ouverts: string[] = []
  on('ui.open', (_: unknown, e: { id: string }) => { ouverts.push(e.id); return { value: { isPlaced: true } } })
  return { ouverts, ecritures, lus }
}
export const demarrer = ($: any, cwd = 'C:/Projet') => $.session.start({ cwd, surface: 'terminal', isInteractive: true })
