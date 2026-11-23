// Carte « Qui êtes-vous ? » : affichée tant que le prénom enregistré (~/.claude/pilotage/config.json) n'est pas un membre de l'équipe du
// projet. Sans elle, tout le panneau reste en lecture seule. Choisir un prénom l'enregistre (voir ecrireConfigPrenom) ; rien d'autre ne s'écrit ici.
import { bulle, carte, titreSection } from './kit'
import type { Ctx } from './kit'

export function carteIdentite(c: Ctx, o: { equipe: string[]; choisir: (prenom: string) => void | Promise<void> }) {
  const { Box, Text, Button } = c.ui
  return carte(c, [
    <Box key="entete" flexDirection="row" alignItems="center" gap="md">
      {bulle(c, 'agent', 40)}
      <Box flexDirection="column" flexShrink={1}>{titreSection(c, 'Qui êtes-vous ?')}</Box>
    </Box>,
    <Text key="aide" color={c.j.texteSec}>
      Choisissez votre prénom dans l’équipe du projet : il est enregistré sur cet ordinateur et sert à ranger vos chantiers, vos idées et vos portes dans votre dossier. Tant qu’il manque, le panneau reste en lecture seule.
    </Text>,
    <Box key="membres" flexDirection="row" flexWrap="wrap" gap="sm">
      {o.equipe.map(m => <Button key={`identite-${m}`} label={m} variant="primary" onPress={(() => o.choisir(m)) as never} />)}
    </Box>,
  ], { cle: 'carte-identite', actif: true })
}
