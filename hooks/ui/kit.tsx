// Composants de base du panneau (maquette §2, §3, §5). Chaque fonction reçoit un contexte `Ctx` (éléments de la
// surface, jetons du mode, surface, colonnes) et rend un arbre : rien ne lit ni n'écrit le disque ici.
// Le terminal n'a pas d'élément Svg : chaque icône y est remplacée par son glyphe texte.
import type { ElementTable } from 'claude-code'

import { avatarSvg, barreSvg, GLYPHES, icone, iconeRonde, pointSvg } from './icones'
import type { NomIcone } from './icones'
import { estMobile, largeurColonne, LIBELLES_ETAT } from './theme'
import type { EtatStatut, Jetons, Teinte } from './theme'

export type Kit = ElementTable

export type Ctx = {
  ui: Kit
  j: Jetons
  surface: string
  colonnes: number
  /** Surface mobile, ou panneau plus étroit que 600 px. */
  mobile: boolean
}

export function creerCtx(ui: Kit, j: Jetons, surface: string, colonnes: number): Ctx {
  return { ui, j, surface, colonnes, mobile: estMobile(surface, colonnes) }
}

// Le terminal ne dessine pas de Svg (la table en donne tout de même un élément vide) : on le teste par la surface.
const avecSvg = (c: Ctx) => (c.surface === 'terminal' ? undefined : (c.ui as { Svg?: unknown }).Svg) as any

/** Icône : un Svg là où la surface en dessine, sinon le glyphe texte (terminal). */
export function iconeEl(c: Ctx, nom: NomIcone, taille = 16, couleur: string = c.j.accent) {
  const Svg = avecSvg(c)
  const { Text } = c.ui
  if (Svg) return <Svg source={icone(nom, couleur, taille)} alt={nom} width={taille} height={taille} />
  return <Text color={couleur}>{GLYPHES[nom]}</Text>
}

/** Bulle d'icône (rond teinté) : accent par défaut, ou la teinte d'un pôle. */
export function bulle(c: Ctx, nom: NomIcone, taille = 40, teinte?: Teinte) {
  const Svg = avecSvg(c)
  const { Text } = c.ui
  const { fg, soft } = teinte ? c.j.poles[teinte] : { fg: c.j.accent, soft: c.j.accentSoft }
  if (Svg) return <Svg source={iconeRonde(nom, soft, fg, taille)} alt={nom} width={taille} height={taille} />
  return <Text color={fg}>{GLYPHES[nom]}</Text>
}

/** Cadre : colonne centrée de 880 px (110 colonnes) au plus ; sur mobile, colonne fluide avec la gouttière de 16 px. */
export function cadre(c: Ctx, enfants: unknown) {
  const { Box } = c.ui
  return (
    <Box
      key="cadre"
      flexDirection="column"
      alignItems="center"
      width="100%"
      backgroundColor={c.j.fond}
      paddingTop={c.mobile ? 'lg' : 'xl'}
      paddingBottom={c.mobile ? 'lg' : 'xl'}
    >
      <Box key="cadre-colonne" flexDirection="column" gap="xl" width={largeurColonne(c.colonnes, c.mobile)}>
        {enfants as never}
      </Box>
    </Box>
  )
}

type OptionsCarte = { cle?: string; actif?: boolean; centre?: boolean; fond?: string; bord?: string }

/** Carte : surface, bordure fine arrondie, jamais de grand aplat coloré ; le bord passe en accent si `actif`. */
export function carte(c: Ctx, enfants: unknown, o: OptionsCarte = {}) {
  const { Box } = c.ui
  return (
    <Box
      key={o.cle ?? 'carte'}
      flexDirection="column"
      gap="lg"
      padding={c.mobile ? 'lg' : 'xl'}
      borderStyle="round"
      borderColor={o.bord ?? (o.actif ? c.j.accent : c.j.bord)}
      backgroundColor={o.fond ?? c.j.surface}
      {...(o.centre ? { alignItems: 'center' as const } : {})}
    >
      {enfants as never}
    </Box>
  )
}

/** Titre de section (Title/Section) avec son aide facultative (Caption). */
export function titreSection(c: Ctx, titre: string, aide?: string) {
  const { Box, Text } = c.ui
  return (
    <Box flexDirection="column" gap="xs">
      <Text weight="semibold" size="heading" color={c.j.texte}>{titre}</Text>
      {aide ? <Text size="caption" color={c.j.texteDim}>{aide}</Text> : null}
    </Box>
  )
}

/** Pastille d'état : toujours l'icône ET le libellé exact, jamais la couleur seule. */
export function pastille(c: Ctx, etat: EtatStatut) {
  const { Box, Text } = c.ui
  const t = c.j.etats[etat]
  return (
    <Box
      key={`pastille-${etat}`}
      alignSelf="flex-start"
      flexDirection="row"
      alignItems="center"
      gap="xs"
      paddingX="sm"
      borderStyle="round"
      borderColor={t.soft}
      backgroundColor={t.soft}
    >
      <Box key={`pastille-icone-${etat}`}>{iconeEl(c, t.icone, 14, t.fg)}</Box>
      <Text weight="semibold" size="footnote" color={t.fg}>{LIBELLES_ETAT[etat]}</Text>
    </Box>
  )
}

/** Chip de pôle : point de 8 px et nom, à la teinte du pôle. */
export function chipPole(c: Ctx, nom: string, teinte: Teinte) {
  const { Box, Text } = c.ui
  const Svg = avecSvg(c)
  const t = c.j.poles[teinte]
  return (
    <Box
      key="chip-pole"
      alignSelf="flex-start"
      flexDirection="row"
      alignItems="center"
      gap="xs"
      paddingX="sm"
      borderStyle="round"
      borderColor={t.soft}
      backgroundColor={t.soft}
    >
      {Svg ? <Svg source={pointSvg(t.fg)} alt="" width={8} height={8} /> : <Text color={t.fg}>●</Text>}
      <Text weight="semibold" size="footnote" color={t.fg}>{nom}</Text>
    </Box>
  )
}

/** Avatar : initiale dans un rond ; neutre pour un membre, teinte du pôle pour un agent. */
export function avatar(c: Ctx, nom: string, teinte?: Teinte) {
  const { Box, Text } = c.ui
  const Svg = avecSvg(c)
  const { fg, soft } = teinte ? c.j.poles[teinte] : { fg: c.j.texteSec, soft: c.j.releve }
  const initiale = (nom.match(/\p{L}/u)?.[0] ?? '?').toUpperCase()
  return (
    <Box key="avatar" alignSelf="flex-start">
      {Svg ? <Svg source={avatarSvg(nom, soft, fg, 28)} alt={nom} width={28} height={28} /> : <Text color={fg}>{`[${initiale}]`}</Text>}
    </Box>
  )
}

/** Barre de progression de 0 à 1 (bornée ; illisible : 0) : le pourcentage est toujours écrit. */
export function barreProgression(c: Ctx, label: string, valeur: number, teinte?: Teinte) {
  const { Box, Text, Progress } = c.ui
  const Svg = avecSvg(c)
  const v = Number.isFinite(valeur) ? Math.max(0, Math.min(1, valeur)) : 0
  const pct = `${Math.round(v * 100)} %`
  const couleur = teinte ? c.j.poles[teinte].fg : c.j.accent
  if (!Svg) return <Progress label={label} value={v} valueText={pct} color={couleur} />
  const largeur = c.mobile ? 160 : 280
  return (
    <Box flexDirection="row" alignItems="center" gap="sm">
      <Svg source={barreSvg(v, c.j.survol, couleur, largeur)} alt={`${label} ${pct}`} width={largeur} height={8} />
      <Text weight="semibold" size="footnote" tabular color={c.j.texte}>{pct}</Text>
    </Box>
  )
}

/**
 * Bouton « Copier le chemin ». Sur mobile (ou panneau étroit) : icône seule, le nom accessible reste « Copier le
 * chemin ». `copier` reçoit le chemin et la surface de l'appui.
 */
export function boutonCopier(c: Ctx, cle: string, chemin: string, copier: (texte: string, surface?: string) => Promise<void>) {
  const { Button, Text } = c.ui
  const onPress = (p: { surface?: string } | undefined) => { void copier(chemin, p?.surface) }
  if (c.mobile) {
    return (
      <Button key={`copier-${cle}`} label="Copier le chemin" variant="secondary" onPress={onPress as never}>
        <Text color={c.j.texteSec}>{GLYPHES.copier}</Text>
      </Button>
    )
  }
  return <Button key={`copier-${cle}`} label="Copier le chemin" variant="secondary" onPress={onPress as never} />
}

/** Copie sur la surface de l'appui puis le dit en une ligne (« Copié » ou l'échec) ; ne lève jamais. */
export function faireCopier($: any): (texte: string, surface?: string) => Promise<void> {
  return async (texte, surface) => {
    let copie = false
    try {
      const r = await $.ui.copy({ text: texte, ...(surface ? { surface } : {}) })
      copie = r?.isCopied === true
    } catch {
      copie = false
    }
    try {
      $.ui.toast(copie ? `Copié : ${texte}` : 'Le chemin n’a pas pu être copié : sélectionnez-le à la main.')
    } catch {
      // Un toast qui échoue ne doit rien casser.
    }
  }
}

export type NiveauBanniere = 'info' | 'avertissement' | 'erreur'
const ETAT_BANNIERE: Record<NiveauBanniere, EtatStatut> = { info: 'reprendre', avertissement: 'attente', erreur: 'bloque' }

/** Bannière : bordure pleine teinte et fond doux (info = prêt à reprendre, avertissement = en attente, erreur = bloqué). */
export function banniere(c: Ctx, niveau: NiveauBanniere, titre: string, message?: string) {
  const { Box, Text } = c.ui
  const t = c.j.etats[ETAT_BANNIERE[niveau]]
  const icon: NomIcone = niveau === 'info' ? 'cible' : 'alerte'
  return (
    <Box key={`banniere-${niveau}`} flexDirection="row" gap="md" padding="md" borderStyle="round" borderColor={t.fg} backgroundColor={t.soft}>
      <Box>{iconeEl(c, icon, 18, t.fg)}</Box>
      <Box flexDirection="column" gap="xs" flexShrink={1}>
        <Text weight="semibold" color={t.fg}>{titre}</Text>
        {message ? <Text size="footnote" color={c.j.texteSec}>{message}</Text> : null}
      </Box>
    </Box>
  )
}
