// Ligne de chantier en cours (maquette « Ligne de chantier », état En cours), partagée par la page Chantiers et
// l'Aperçu. Son bouton ouvre la page « Chantier ouvert » (ui/chantier-ouvert.tsx). LIT seulement. Le texte des fiches
// est une donnée : il n'est jamais interprété, seulement affiché.
import { etatAffiche, progressionChantier } from '../model/chantier.ts'
import type { Chantier } from '../model/chantier.ts'
import { etatStatut, nomAgent } from '../model/chantiers.ts'
import type { Projet } from '../model/projet.ts'
import { pluriel } from './apercu'
import { avatar, barreProgression, boutonCopier, bulle, carte, pastille } from './kit'
import type { Ctx } from './kit'
import { couleurPole } from './theme'
import type { Teinte } from './theme'

export type DonneesLigne = {
  projet: Projet
  maintenant: number
  copier: (texte: string, surface?: string) => Promise<void>
  /** Clé du chantier ouvert (page « Chantier ouvert ») ; absent : pas de bouton pour l'ouvrir (Aperçu). */
  ouvert?: string
  /** Ouvre un chantier par sa clé ('' : retour à la liste). */
  ouvrir?: (cle: string) => void | Promise<void>
}

/** Une clé par chantier : son id, suivi du prénom de l'auteur quand deux membres ont le même id. */
export function cles(liste: Chantier[]): string[] {
  return liste.map(c => (liste.filter(x => x.id === c.id).length > 1 ? `${c.id}-${c.auteur}` : c.id))
}

/** Titre et teinte du pôle d'un chantier ; teinte absente quand le pôle n'est pas (ou plus) dans le projet. */
export function poleDe(projet: Projet, c: Chantier): { titre: string; teinte: Teinte | undefined } {
  const i = projet.poles.findIndex(p => p.id === c.pole)
  if (i < 0) return { titre: c.pole === '' ? 'sans pôle' : c.pole, teinte: undefined }
  return { titre: projet.poles[i]!.titre, teinte: couleurPole(projet.poles[i]!.couleur, i) }
}

/** Ligne de fichier : chemin et bouton « Copier le chemin ». */
export function ligneFichier(c: Ctx, d: Pick<DonneesLigne, 'copier'>, cle: string, chemin: string) {
  const { Box, Text } = c.ui
  return (
    <Box key={`fichier-${cle}`} flexDirection="row" alignItems="center" justifyContent="space-between" gap="md" padding="sm" backgroundColor={c.j.releve}>
      <Box flexDirection="row" alignItems="center" gap="sm" flexShrink={1}>
        {bulle(c, 'fichier', 24)}
        <Text size="footnote" mono color={c.j.texteSec}>{chemin}</Text>
      </Box>
      {boutonCopier(c, `fichier-${cle}`, chemin, d.copier)}
    </Box>
  )
}

/** Ligne d'un chantier en cours : titre, session, pôle, état (règle des 15 minutes), progression, agents, copie du nom de session. */
export function ligneChantier(c: Ctx, d: DonneesLigne, ch: Chantier, cle: string) {
  const { Box, Text, Button } = c.ui
  const { j } = c
  const pole = poleDe(d.projet, ch)
  const etat = etatAffiche(ch, d.maintenant)
  const p = progressionChantier(ch)
  const noms = ch.agents.map(a => nomAgent(d.projet, a.id))
  return carte(c, [
    <Box key="entete" flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap="md">
      <Box flexDirection="row" alignItems="center" gap="md" flexShrink={1}>
        {bulle(c, 'chantier', 40, pole.teinte)}
        <Box flexDirection="column" flexShrink={1}>
          <Text weight="semibold" color={j.texte}>{ch.titre}</Text>
          <Text size="caption" color={j.texteDim}>{`Session : ${ch.session === '' ? 'non liée' : ch.session} · pôle ${pole.titre}`}</Text>
        </Box>
      </Box>
      <Box key={`etat-${cle}`} flexDirection="column" alignItems="flex-end" gap="xs">
        {pastille(c, etatStatut(etat))}
        {etat !== ch.etat ? <Text size="caption" color={j.texteDim}>Sans nouvelle depuis plus de 15 minutes</Text> : null}
      </Box>
    </Box>,
    <Box key="progression" flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
      {barreProgression(c, `Avancement du chantier ${ch.titre}`, p.pourcent / 100, pole.teinte)}
      <Text size="caption" color={j.texteDim}>{`${pluriel(p.faites, 'tâche faite', 'tâches faites')} sur ${p.total}`}</Text>
    </Box>,
    <Box key="actions" flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap="md">
      <Box key="agents" flexDirection="row" alignItems="center" gap="sm" flexShrink={1}>
        {noms.slice(0, 3).map((n, k) => <Box key={`avatar-${k}`}>{avatar(c, n, pole.teinte)}</Box>)}
        <Text size="footnote" color={j.texteSec}>{noms.length === 0 ? 'Aucun agent appelé' : `${noms.length > 1 ? 'Agents' : 'Agent'} : ${noms.join(', ')}`}</Text>
      </Box>
      <Box flexDirection="row" flexWrap="wrap" gap="sm">
        {d.ouvrir ? <Button key={`ouvrir-${cle}`} label="Ouvrir le chantier" variant="secondary" onPress={() => d.ouvrir!(cle)} /> : null}
        {ch.session !== '' ? boutonCopier(c, `session-${cle}`, ch.session, d.copier, 'Copier le nom de la session') : null}
      </Box>
    </Box>,
  ], { cle: `chantier-${cle}` })
}
