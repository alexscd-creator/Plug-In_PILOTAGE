// Pages pas encore remplies (Idées, Paramètres) : une carte honnête (titre, « Bientôt », ce que la page montrera).
// La page Agents a son écran complet (agents.tsx).
import type { Page } from '../../types'
import type { Projet } from '../model/projet.ts'
import { carte, titreSection } from './kit'
import type { Ctx } from './kit'

const PAGES_AVENIR: Partial<Record<Page, { titre: string; phrase: string }>> = {
  idees: { titre: 'Idées', phrase: 'Les idées et retours classés automatiquement.' },
  parametres: { titre: 'Paramètres', phrase: 'Thème, workflow, agents, pôles et réglages du type de projet.' },
}

export type DonneesAvenir = { projet: Projet; copier: (texte: string, surface?: string) => Promise<void> }

function carteBientot(c: Ctx, page: Page) {
  const { Box, Text } = c.ui
  const d = PAGES_AVENIR[page]!
  return carte(c, [
    <Box key="entete" flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
      {titreSection(c, d.titre)}
      <Box key="etiquette-bientot" alignSelf="flex-start" paddingX="sm" borderStyle="round" borderColor={c.j.accentSoft} backgroundColor={c.j.accentSoft}>
        <Text weight="semibold" size="footnote" color={c.j.accent}>Bientôt</Text>
      </Box>
    </Box>,
    <Text key="phrase" color={c.j.texteSec}>{d.phrase}</Text>,
  ], { cle: `carte-avenir-${page}` })
}

export function pageAvenir(c: Ctx, page: Page, _d: DonneesAvenir) {
  return PAGES_AVENIR[page] ? [carteBientot(c, page)] : []
}
