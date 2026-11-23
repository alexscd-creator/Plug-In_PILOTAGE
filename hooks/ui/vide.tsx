// États sans données de la maquette (§6, écrans 08) : démarrage vide, erreur de fichier de projet, carte « À venir »
// et carte d'erreur d'affichage. Rien ici ne lit ni n'écrit le disque.
import { decrireRetour } from '../model/retour-commande.ts'
import type { ModeRetour } from '../model/retour-commande.ts'
import { banniere, boutonCopier, bulle, carte, iconeEl, titreSection } from './kit'
import type { Ctx } from './kit'

/** La commande que le bouton « Démarrer un projet » envoie dans la conversation. */
export const COMMANDE_DEMARRER = '/pilotage:demarrer'
export const FICHIER_PROJET = '.pilotage/projet.json'
const MAX_ERREURS = 8

/** Message sous le bouton de commande : ce qui a marché, et la commande à copier quand rien n'a marché. */
export function retourCommande(c: Ctx, brut: string, copier: (texte: string) => Promise<void>) {
  const r = decrireRetour(brut)
  if (!r) return null
  const { Box, Text, Button } = c.ui
  const message: Record<ModeRetour, string> = {
    rempli: 'La commande est prête dans la zone de saisie : appuyez sur Entrée pour l’envoyer.',
    copie: 'Commande copiée : collez-la dans la conversation (Ctrl+V), puis Entrée.',
    'copie-echec': 'Sélectionnez la commande ci-dessous, copiez-la et collez-la dans la conversation.',
    taper: 'Collez ou tapez cette commande dans la conversation :',
  }
  return (
    <Box key="retour-commande" flexDirection="column" gap="xs">
      <Text color={c.j.accent}>{message[r.mode]}</Text>
      {(r.mode === 'taper' || r.mode === 'copie-echec') && <Text mono color={c.j.texte}>{r.texte}</Text>}
      {r.mode !== 'rempli' && (
        <Box alignSelf="flex-start">
          <Button key="commande-copier" label="Copier la commande" variant="secondary" onPress={() => copier(r.texte)} />
        </Box>
      )}
    </Box>
  )
}

/** Démarrage vide : « Aucun projet ici » et le bouton qui lance /pilotage:demarrer. */
export function ecranVide(c: Ctx, o: { demarrer: (surface?: string) => Promise<void>; retour: unknown }) {
  const { Box, Text, Button } = c.ui
  const { j } = c
  return (
    <Box flexDirection="column" gap="lg">
      {carte(c, [
        <Box key="bulle" alignSelf="center">{bulle(c, 'dossier', 64)}</Box>,
        <Text key="titre" weight="bold" size="title" color={j.texte}>Aucun projet ici</Text>,
        <Text key="texte" color={j.texteSec}>
          Ce dossier n’a pas encore de projet Pilotage. Démarrez-en un : quelques questions, une à la fois (type de projet, nom, objectif, pôles).
        </Text>,
        <Button key="demarrer" label="Démarrer un projet" variant="primary" onPress={(p: { surface?: string } | undefined) => o.demarrer(p?.surface)} />,
        <Text key="aide" size="caption" color={j.texteDim}>{`Ce bouton lance la commande ${COMMANDE_DEMARRER} dans la conversation.`}</Text>,
        (o.retour as never) ?? null,
      ], { cle: 'carte-vide', centre: true })}
    </Box>
  )
}

/** Erreur de fichier de projet : bannière, erreurs en français, « Que faire ? » avec le fichier à copier et « Réessayer ». */
export function ecranErreur(c: Ctx, o: { erreurs: string[]; reessayer: () => Promise<void>; copier: (texte: string, surface?: string) => Promise<void> }) {
  const { Box, Text, Button } = c.ui
  const { j } = c
  const vues = o.erreurs.slice(0, MAX_ERREURS)
  const reste = o.erreurs.length - vues.length
  return (
    <Box flexDirection="column" gap="lg">
      {banniere(c, 'erreur', 'Fichier de projet illisible', `Le fichier ${FICHIER_PROJET} n’a pas pu être lu tel quel : ${o.erreurs.length} problème${o.erreurs.length > 1 ? 's' : ''} à corriger.`)}
      <Box flexDirection="column" gap="xs">
        {vues.map((e, i) => <Text key={`erreur-${i}`} color={j.texteSec}>{`• ${e}`}</Text>)}
        {reste > 0 && <Text color={j.texteDim}>{`… et ${reste} autre${reste > 1 ? 's' : ''}`}</Text>}
      </Box>
      {carte(c, [
        titreSection(c, 'Que faire ?', 'Corrigez le fichier à la main (chaque ligne ci-dessus dit quoi changer), puis appuyez sur Réessayer.'),
        <Box key="ligne-fichier" flexDirection={c.mobile ? 'column' : 'row'} alignItems={c.mobile ? 'flex-start' : 'center'} justifyContent="space-between" gap="sm">
          <Box flexDirection="row" alignItems="center" gap="sm" flexShrink={1}>
            {iconeEl(c, 'fichier', 16, j.texteSec)}
            <Text size="caption" color={j.texteSec} wrap="truncate-middle">{FICHIER_PROJET}</Text>
          </Box>
          {boutonCopier(c, 'projet', FICHIER_PROJET, o.copier)}
        </Box>,
        <Box key="actions" alignSelf="flex-start">
          <Button key="reessayer" label="Réessayer" variant="primary" onPress={() => o.reessayer()} />
        </Box>,
      ], { cle: 'carte-erreur' })}
    </Box>
  )
}

/** Le panneau n'a pas pu se dessiner : on le dit, sans jamais planter. */
export function carteErreurRendu(c: Ctx) {
  return banniere(c, 'erreur', 'Le panneau n’a pas pu s’afficher', 'Appuyez sur Rafraîchir ; si le problème reste, relancez la session.')
}
