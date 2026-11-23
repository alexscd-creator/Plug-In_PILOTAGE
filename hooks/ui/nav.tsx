// Barre du haut et navigation par onglets (maquette §2). Les onglets suivent l'ordre de la maquette.
import type { Page } from '../../types'
import { bulle } from './kit'
import type { Ctx } from './kit'
import { GLYPHES } from './icones'
import type { NomIcone } from './icones'

export const PAGES: { page: Page; titre: string; icone: NomIcone }[] = [
  { page: 'apercu', titre: 'Aperçu', icone: 'apercu' },
  { page: 'plan', titre: 'Plan', icone: 'plan' },
  { page: 'phases', titre: 'Phases', icone: 'phase' },
  { page: 'chantiers', titre: 'Chantiers', icone: 'chantier' },
  { page: 'agents', titre: 'Agents', icone: 'agent' },
  { page: 'idees', titre: 'À faire', icone: 'idee' },
  { page: 'parametres', titre: 'Paramètres', icone: 'reglages' },
]

/** Libellé d'un onglet : son icône puis son titre (sur desktop, un bouton n'affiche que son libellé). */
export const libelleOnglet = (p: { titre: string; icone: NomIcone }): string => `${GLYPHES[p.icone]}  ${p.titre}`

/**
 * Barre d'onglets : une pilule bordée ; l'onglet actif a le fond et le texte d'accent. Sur mobile elle reste sur une
 * ligne et défile à l'horizontale ; ailleurs les onglets passent à la ligne si la place manque.
 */
export function navigation(c: Ctx, courante: Page, aller: (p: Page) => void | Promise<void>) {
  const { Box, Button, Text } = c.ui
  const { j } = c
  return (
    <Box
      key="navigation"
      flexDirection="row"
      gap="xs"
      padding="sm"
      justifyContent="center"
      alignItems="center"
      borderStyle="round"
      borderColor={j.bord}
      backgroundColor={j.surface}
      {...(c.mobile ? { overflowX: 'scroll' as const } : { flexWrap: 'wrap' as const })}
    >
      {PAGES.map(p => {
        const actif = p.page === courante
        const fg = actif ? j.accent : j.texteSec
        const libelle = libelleOnglet(p)
        return (
          <Box
            key={`onglet-${p.page}`}
            flexShrink={0}
            {...(actif ? { backgroundColor: j.accentSoft } : {})}
          >
            <Button key={`nav-${p.page}`} label={libelle} variant={actif ? 'primary' : 'secondary'} onPress={() => aller(p.page)}>
              <Text color={fg} weight={actif ? 'semibold' : 'regular'}>{libelle}</Text>
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
  // Boutons icône seule, comme la maquette : le symbole est le libellé (le terminal garde le mot, plus lisible).
  const bouton = (cle: string, label: string, icone: NomIcone, f: () => void | Promise<void>) => {
    const texte = c.surface === 'terminal' ? label : GLYPHES[icone]
    return (
      <Button key={cle} label={texte} variant="secondary" onPress={() => f()}>
        <Text color={j.texteSec}>{texte}</Text>
      </Button>
    )
  }
  return (
    <Box key="barre-haut" flexDirection="row" alignItems="center" justifyContent="space-between" gap="md" width="100%">
      <Box flexDirection="row" alignItems="center" gap="md" flexShrink={1}>
        {bulle(c, o.icone, c.mobile ? 44 : 56)}
        <Box flexDirection="column" flexShrink={1}>
          <Text size="footnote" weight="semibold" color={j.texteDim}>{`Pilotage · ${o.type}`}</Text>
          <Text weight="bold" size={c.mobile ? 'heading' : 'title'} color={j.texte} wrap="truncate-end">{o.nom}</Text>
        </Box>
      </Box>
      <Box flexDirection="row" gap="xs" flexShrink={0}>
        {bouton('nav-rafraichir', 'Rafraîchir', 'rafraichir', o.rafraichir)}
        {bouton('nav-reglages', 'Paramètres', 'reglages', o.reglages)}
      </Box>
    </Box>
  )
}
