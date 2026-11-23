// Ligne de chantier en cours (maquette « Ligne de chantier », état En cours), partagée par la page Chantiers et la
// Vue d'ensemble, et son détail (maquette « Chantier ouvert »). LIT seulement. Le texte des fiches est une donnée :
// il n'est jamais interprété, seulement affiché.
import { etatAffiche, progressionChantier } from '../model/chantier.ts'
import type { Chantier } from '../model/chantier.ts'
import { etatAgentAffiche, etatStatut, nomAgent } from '../model/chantiers.ts'
import type { Projet } from '../model/projet.ts'
import { pluriel } from './apercu'
import { avatar, barreProgression, boutonCopier, bulle, carte, pastille } from './kit'
import type { Ctx } from './kit'
import { statut } from './plan'
import { couleurPole } from './theme'
import type { Teinte } from './theme'

export type DonneesLigne = {
  projet: Projet
  maintenant: number
  copier: (texte: string, surface?: string) => Promise<void>
  /** Clé du chantier dont le détail est ouvert ; absent : pas de bouton de détail (Vue d'ensemble). */
  ouvert?: string
  basculer?: (cle: string) => void | Promise<void>
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

function detail(c: Ctx, d: DonneesLigne, ch: Chantier, cle: string) {
  const { Box, Text } = c.ui
  const { j } = c
  const pole = poleDe(d.projet, ch)
  return (
    <Box key={`detail-chantier-${cle}`} flexDirection="column" gap="lg" paddingTop="md" borderStyle="round" borderColor={j.bord}>
      <Text key="resume" size="footnote" color={j.texteSec}>{`Pôle ${pole.titre} · session ${ch.session === '' ? 'non liée' : ch.session} · ouvert le ${ch.cree.slice(0, 10)}`}</Text>
      <Box key="agents" flexDirection="column" gap="sm">
        <Text weight="semibold" color={j.texte}>Agents sollicités</Text>
        {ch.agents.length === 0 ? <Text color={j.texteDim}>Aucun agent n’a encore été appelé.</Text> : null}
        {ch.agents.map(a => (
          <Box key={`agent-${a.id}`} flexDirection="row" flexWrap="wrap" alignItems="center" gap="sm">
            {avatar(c, nomAgent(d.projet, a.id), pole.teinte)}
            <Text weight="semibold" color={j.texte}>{nomAgent(d.projet, a.id)}</Text>
            {a.quoi !== '' ? <Text color={j.texteSec}>{a.quoi}</Text> : null}
            <Box key={`pastille-agent-${a.id}`}>{pastille(c, etatStatut(etatAgentAffiche(ch, a.etat, d.maintenant)))}</Box>
          </Box>
        ))}
      </Box>
      <Box key="taches" flexDirection="column" gap="sm">
        <Text weight="semibold" color={j.texte}>Tâches du chantier</Text>
        {ch.taches.length === 0 ? <Text color={j.texteDim}>Aucune tâche pour l’instant.</Text> : null}
        {ch.taches.map((t, k) => (
          <Box key={`tache-${cle}-${k}`} flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
            {statut(c, t.statut, `statut-${cle}-${k}`)}
            <Text color={t.statut === 'abandonne' ? j.texteDim : j.texte}>{t.titre}</Text>
          </Box>
        ))}
      </Box>
      <Box key="fichiers" flexDirection="column" gap="sm">
        <Text weight="semibold" color={j.texte}>Fichiers du chantier</Text>
        {ch.fichiers.length === 0 ? <Text color={j.texteDim}>Aucun fichier pour l’instant.</Text> : null}
        {ch.fichiers.map((f, k) => ligneFichier(c, d, `${cle}-${k}`, f))}
      </Box>
    </Box>
  )
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
  const ouvert = d.basculer !== undefined && d.ouvert === cle
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
        {d.basculer ? (
          <Button key={`detail-${cle}`} label={ouvert ? 'Masquer le détail' : 'Voir le détail'} variant="secondary" onPress={() => d.basculer!(ouvert ? '' : cle)} />
        ) : null}
        {ch.session !== '' ? boutonCopier(c, `session-${cle}`, ch.session, d.copier, 'Copier le nom de la session') : null}
      </Box>
    </Box>,
    ouvert ? detail(c, d, ch, cle) : null,
  ], { cle: `chantier-${cle}` })
}
