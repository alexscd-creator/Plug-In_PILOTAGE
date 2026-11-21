// Bandeau de chantier (maquette §6, écran 05) : sous la barre du haut, sur toutes les pages, tant que la session
// courante est celle d'un chantier en cours. Montre les agents actuellement sollicités avec leur pastille. LIT seulement.
import type { Chantier } from '../model/chantier.ts'
import { etatAgentAffiche, etatStatut, nomAgent } from '../model/chantiers.ts'
import type { Projet } from '../model/projet.ts'
import { avatar, chipPole, iconeEl, pastille } from './kit'
import type { Ctx } from './kit'
import { poleDe } from './ligne-chantier'

export function bandeauChantier(c: Ctx, o: { chantier: Chantier; projet: Projet; maintenant: number }) {
  const { Box, Text } = c.ui
  const { j } = c
  const { chantier: ch } = o
  const pole = poleDe(o.projet, ch)
  // Les agents « sollicités » : ceux dont le travail n'est pas terminé.
  const agents = ch.agents.filter(a => a.etat !== 'termine')
  return (
    <Box key="bandeau-chantier" flexDirection="column" gap="md" padding="md" borderStyle="round" borderColor={j.accent} backgroundColor={j.accentSoft}>
      <Box key="titre" flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
        {iconeEl(c, 'chantier', 18, j.accent)}
        <Text weight="semibold" color={j.accent}>{`Vous êtes dans le chantier : ${ch.titre}`}</Text>
        {pole.teinte ? chipPole(c, pole.titre, pole.teinte) : null}
      </Box>
      {agents.map(a => (
        <Box key={`bandeau-agent-${a.id}`} flexDirection="row" flexWrap="wrap" alignItems="center" gap="sm">
          {avatar(c, nomAgent(o.projet, a.id), pole.teinte)}
          <Text weight="semibold" color={j.texte}>{nomAgent(o.projet, a.id)}</Text>
          {a.quoi !== '' ? <Text color={j.texteSec}>{a.quoi}</Text> : null}
          <Box key={`bandeau-pastille-${a.id}`}>{pastille(c, etatStatut(etatAgentAffiche(ch, a.etat, o.maintenant)))}</Box>
        </Box>
      ))}
    </Box>
  )
}
