declare module 'claude-code' {
  interface PluginState {
    pilotage: {
      /** Vrai quand un projet valide est ouvert dans la session. */
      actif: boolean
      /** Dossier racine du projet trouvé ('' sans projet). */
      projetTrouve: string
      /** Membre courant d'après la config ('' si inconnu). */
      membre: string
      /** Erreurs du marqueur invalide, rappelées par /pilotage. */
      erreursMarqueur: string[]
    }
  }
}
