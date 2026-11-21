/** Pages du panneau, dans l'ordre des onglets de la maquette. */
export type Page = 'apercu' | 'plan' | 'phases' | 'chantiers' | 'agents' | 'idees' | 'parametres'
/** Thème choisi : le mod ne peut pas lire le mode de l'application, « systeme » prend le sombre. */
export type ChoixTheme = 'systeme' | 'clair' | 'sombre'

/** Suivi des agents en direct (le contrat doit se suffire : même forme que `Live` de hooks/model/agents-live.ts). */
export type AgentsLive = {
  /** Appels de l'outil Agent en cours : clé de l'appel, agent du projet, ce qu'il fait, début (ms). */
  appels: { cle: string; agent: string; quoi: string; depuis: number }[]
  /** Issue du dernier appel d'un agent dont plus aucun appel ne dure. */
  derniers: { agent: string; etat: 'pret' | 'bloque'; quoi: string; depuis: number }[]
  /** Appels de question à la personne en cours (identifiant et début en ms). */
  attentes: { cle: string; depuis: number }[]
}

declare module 'claude-code' {
  interface PluginState {
    pilotage: {
      /** Vrai quand un projet valide est ouvert dans la session. */
      actif: Shaped<boolean>
      /** Dossier racine du projet trouvé ('' sans projet). */
      projetTrouve: Shaped<string>
      /** Membre courant d'après la config ('' si inconnu). */
      membre: Shaped<string>
      /** Erreurs du marqueur invalide, rappelées par /pilotage. */
      erreursMarqueur: Shaped<string[]>
      /** Page affichée dans le panneau. */
      page: Shaped<Page>
      /** Phase ouverte dans la page Phases ('' : la phase en cours). */
      phaseOuverte: Shaped<string>
      /** Chantier dont le détail est ouvert dans la page Chantiers ('' : aucun). */
      chantierOuvert: Shaped<string>
      /** Pôle filtré dans la page Agents ('' : tous). */
      filtrePole: Shaped<string>
      /** Agent dont le détail est ouvert dans la page Agents ('' : la grille). */
      agentOuvert: Shaped<string>
      /** Compteur de rafraîchissement : un changement force une nouvelle lecture des fichiers. */
      tick: Shaped<number>
      /** Thème du panneau. */
      theme: Shaped<ChoixTheme>
      /** Ce qui s'est passé quand un bouton a voulu envoyer une commande (vide : tout est parti). */
      retourCommande: Shaped<string>
      /** Appels d'agents en cours et issues récentes, questions en attente de réponse (voir model/agents-live.ts). */
      agentsLive: Shaped<AgentsLive>
      /** Dernière erreur d'écriture de l'état des agents dans une fiche ('' : la dernière écriture a réussi). Affichée nulle part pour l'instant. */
      erreurEcriture: Shaped<string>
    }
  }
}
