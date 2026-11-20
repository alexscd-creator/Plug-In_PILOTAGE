export const PANE = {
  plugin: 'pilotage',
  component: 'Pane',
  requestId: 'pilotage',
  props: {
    title: 'Pilotage',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

export const HOME = 'C:/Users/Jo'
export const SURFACES = ['terminal', 'desktop'] as const

// Le moteur rend les chemins absolus avec des antislashs : le faux disque compare avec des barres obliques.
export const sl = (p: string): string => p.replaceAll(String.fromCharCode(92), '/')

/** Un faux disque : les fichiers sont des chemins, les dossiers se déduisent. */
export function disque(on: Function, fichiers: Record<string, string>) {
  on('env.get', () => ({ value: HOME }))
  on('fs.read', (_: unknown, e: { path: string }) => ({ value: fichiers[sl(e.path)] ?? '' }))
  on('fs.list', (_: unknown, e: { path: string }) => {
    const prefixe = sl(e.path).replace(/\/$/, '') + '/'
    const noms = new Map<string, 'file' | 'dir'>()
    for (const f of Object.keys(fichiers)) {
      if (!f.startsWith(prefixe)) continue
      const [premier, ...suite] = f.slice(prefixe.length).split('/')
      noms.set(premier!, suite.length ? 'dir' : 'file')
    }
    return { value: [...noms].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 0, isLink: false })) }
  })
}
