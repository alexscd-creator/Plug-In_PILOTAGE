// Pages pas encore remplies (Chantiers, Agents, Idées, Paramètres) : une carte honnête (titre, « Bientôt », ce que la
// page montrera). Pour Agents, la liste des agents du projet en lecture seule : aucun état en direct n'existe encore.
import type { Page } from '../../types'
import type { AgentDef, Projet } from '../model/projet.ts'
import { avatar, boutonCopier, carte, chipPole, titreSection } from './kit'
import type { Ctx } from './kit'
import { couleurPole } from './theme'

const PAGES_AVENIR: Partial<Record<Page, { titre: string; phrase: string }>> = {
  chantiers: { titre: 'Chantiers', phrase: 'Les chantiers en cours et archivés, avec l’état de chaque sous-session.' },
  agents: { titre: 'Agents', phrase: 'Les agents du projet, leurs skills et leur état en direct.' },
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

function carteAgent(c: Ctx, d: DonneesAvenir, a: AgentDef) {
  const { Box, Text } = c.ui
  const i = d.projet.poles.findIndex(p => p.id === a.pole)
  const pole = i < 0 ? null : d.projet.poles[i]!
  const teinte = couleurPole(pole?.couleur, Math.max(i, 0))
  return carte(c, [
    <Box key="entete" flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
      {avatar(c, a.titre, teinte)}
      <Text weight="semibold" color={c.j.texte}>{a.titre}</Text>
      {pole ? chipPole(c, pole.titre, teinte) : null}
    </Box>,
    a.pourquoi ? <Text key="pourquoi" color={c.j.texteSec}>{`Pourquoi spécialisé : ${a.pourquoi}`}</Text> : null,
    a.skills.length > 0 ? (
      <Box key="skills" flexDirection="row" flexWrap="wrap" gap="sm">
        {a.skills.map((s, k) => (
          <Box key={`skill-${a.id}-${k}`} flexDirection="row" alignItems="center" gap="xs" paddingX="sm" borderStyle="round" borderColor={c.j.bord} backgroundColor={c.j.releve}>
            <Text size="caption" mono color={c.j.texteSec}>{s}</Text>
            {boutonCopier(c, `skill-${a.id}-${k}`, s, d.copier, 'Copier le nom du skill')}
          </Box>
        ))}
      </Box>
    ) : null,
  ], { cle: `agent-${a.id}` })
}

export function pageAvenir(c: Ctx, page: Page, d: DonneesAvenir) {
  const { Text } = c.ui
  if (!PAGES_AVENIR[page]) return []
  const carteTete = carteBientot(c, page)
  if (page !== 'agents') return [carteTete]
  if (d.projet.agents.length === 0) return [carteTete, <Text key="aucun-agent" color={c.j.texteDim}>Aucun agent défini pour ce projet.</Text>]
  return [carteTete, ...d.projet.agents.map(a => carteAgent(c, d, a))]
}
