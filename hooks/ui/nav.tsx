// Barre du haut et navigation par onglets (maquette §2). Les onglets suivent l'ordre de la maquette.
import type { Page } from '../../types'
import { bulle } from './kit'
import type { Ctx } from './kit'
import { GLYPHES } from './icones'
import type { NomIcone } from './icones'

export const PAGES: { page: Page; titre: string; icone: NomIcone }[] = [
  { page: 'apercu', titre: 'Vue d’ensemble', icone: 'apercu' },
  { page: 'plan', titre: 'Plan', icone: 'plan' },
  { page: 'phases', titre: 'Phases', icone: 'phase' },
  { page: 'chantiers', titre: 'Chantiers', icone: 'chantier' },
  { page: 'agents', titre: 'Agents', icone: 'agent' },
  { page: 'idees', titre: 'Idées', icone: 'idee' },
  { page: 'parametres', titre: 'Paramètres', icone: 'reglages' },
]

/**
 * Barre d'onglets : une pilule bordée ; l'onglet actif a le fond et le texte d'accent. Sur mobile elle reste sur une
 * ligne et défile à l'horizontale ; ailleurs les onglets passent à la ligne si la place manque.
 */
export function navigation(c: Ctx, courante: Page, aller: (p: Page) => void | Promise<void>) {
  const { Box, Button, Text } = c.ui
  const { j } = c
  const cadres = c.surface !== 'terminal'
  return (
    <Box
      key="navigation"
      flexDirection="row"
      gap="xs"
      padding="xs"
      borderStyle="round"
      borderColor={j.bord}
      backgroundColor={j.surface}
      {...(c.mobile ? { overflowX: 'scroll' as const } : { flexWrap: 'wrap' as const })}
    >
      {PAGES.map(p => {
        const actif = p.page === courante
        const fg = actif ? j.accent : j.texteSec
        return (
          <Box
            key={`onglet-${p.page}`}
            flexShrink={0}
            paddingX="sm"
            {...(actif ? { backgroundColor: j.accentSoft } : {})}
            {...(cadres ? { borderStyle: 'round', borderColor: actif ? j.accentSoft : j.surface } : {})}
          >
            <Button key={`nav-${p.page}`} label={p.titre} onPress={() => aller(p.page)}>
              <Text color={fg} weight={actif ? 'semibold' : 'regular'}>{`${GLYPHES[p.icone]} ${p.titre}`}</Text>
            </Button>
          </Box>
        )
      })}
    </Box>
  )
}

export type OptionsHaut = {
  /** Libellé du type de projet (« Site web »). */
  type: string
  icone: NomIcone
  nom: string
  rafraichir: () => void | Promise<void>
  reglages: () => void | Promise<void>
}

/** Barre du haut : bulle du type, surtitre « Pilotage · <type> », nom du projet ; à droite rafraîchir et paramètres. */
export function barreHaut(c: Ctx, o: OptionsHaut) {
  const { Box, Text, Button } = c.ui
  const { j } = c
  const bouton = (cle: string, label: string, icone: NomIcone, f: () => void | Promise<void>) => (
    <Button key={cle} label={label} variant="secondary" onPress={() => f()}>
      <Text color={j.texteSec}>{GLYPHES[icone]}</Text>
    </Button>
  )
  return (
    <Box key="barre-haut" flexDirection="row" alignItems="center" justifyContent="space-between" gap="md" width="100%">
      <Box flexDirection="row" alignItems="center" gap="md" flexShrink={1}>
        {bulle(c, o.icone, 40)}
        <Box flexDirection="column" flexShrink={1}>
          <Text size="caption" weight="semibold" color={j.texteDim}>{`Pilotage · ${o.type}`}</Text>
          <Text weight="semibold" color={j.texte} wrap="truncate-end">{o.nom}</Text>
        </Box>
      </Box>
      <Box flexDirection="row" gap="xs" flexShrink={0}>
        {bouton('nav-rafraichir', 'Rafraîchir', 'rafraichir', o.rafraichir)}
        {bouton('nav-reglages', 'Paramètres', 'reglages', o.reglages)}
      </Box>
    </Box>
  )
}
