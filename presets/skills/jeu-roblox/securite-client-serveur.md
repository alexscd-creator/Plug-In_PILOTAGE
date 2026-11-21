---
name: securite-client-serveur
description: "Règles de sécurité client-serveur de Roblox (le client est contrôlé par le tricheur, le serveur est l'autorité), avec source et date. À charger avant d'écrire du code qui reçoit des données du client."
---

# Securite client serveur

Le jeu est en ligne : tout ce qui vient du client peut être falsifié. Ce skill rassemble ce que la documentation officielle dit à ce sujet.

**Règles d'usage.** Chaque entrée porte sa source et sa date de vérification. Un fait de plus de six mois est à revérifier. Ce qui n'est pas listé ici est « non vérifié » : fais-le vérifier par le chercheur-analyste du projet avant de t'y fier, n'invente rien.

## Entrées vérifiées

### Le client n'est jamais digne de confiance
- Fait :
  - Le client est traité comme entièrement contrôlé par un tricheur ; toute règle appliquée seulement côté client sera contournée.
  - Toute donnée envoyée par le client peut être modifiée, inventée ou malveillante.
  - Un tricheur peut notamment : décompiler tout LocalScript ou ModuleScript répliqué ; prendre le contrôle réseau de son personnage et des pièces non ancrées ; déclencher Touched ou ProximityPrompt à n'importe quelle distance et fréquence ; modifier sa position et sa physique ; appeler des RemoteEvent et RemoteFunction à n'importe quelle fréquence avec des arguments arbitraires (sauf le premier, le Player) ; modifier son DataModel local sans déclencher les événements attendus.
  - Toute logique critique est validée côté serveur ou exécutée seulement sur le serveur.
- Source : https://create.roblox.com/docs/en-us/scripting/security/security-tactics.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Aucune règle de jeu, aucun gain, aucun achat ne se décide dans un script client. Chaque RemoteEvent reçu par le serveur valide ses arguments (type, valeur, plage) comme s'ils venaient d'un tricheur.

### Le serveur est la source de vérité
- Fait :
  - Le serveur détient l'état de simulation, les règles, la progression des joueurs et les décisions critiques ; le client dessine le monde et envoie les actions du joueur.
  - Rôle du serveur : recevoir l'action, vérifier qu'elle est possible et permise, l'exécuter en mettant à jour l'état de référence, puis répliquer le résultat.
  - Exemple de la page : pour un achat, le serveur doit connaître le vrai prix, l'argent du joueur et la distance réelle du personnage à la boutique avant d'accepter ; c'est lui qui retire le prix.
  - L'état à valider est gardé uniquement côté serveur quand c'est possible.
- Source : https://create.roblox.com/docs/en-us/scripting/security/security-tactics.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Prix, monnaie, inventaire et progression vivent côté serveur ; le client ne fait qu'afficher et demander.

### Penser la sécurité dès la conception
- Fait :
  - Pour chaque nouvelle fonctionnalité, la page recommande de se demander : comment un attaquant maître du client l'exploiterait-il ? quel est le pire résultat s'il envoie n'importe quelle valeur pour chaque paramètre ? que se passe-t-il à plus de 1 000 utilisations par seconde, et quel débit maximal autoriser ? peut-elle gâcher l'expérience d'un autre joueur ? quelle est la consommation de ressources dans le pire cas ?
  - Séparer les responsabilités dès le début : logique et données dans ServerScriptService, pas dans un conteneur répliqué comme ReplicatedStorage ou Workspace.
- Source : https://create.roblox.com/docs/en-us/scripting/security/security-tactics.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Chaque chantier de code commence par ces questions, notées dans la fiche. Le code secret ou critique n'est jamais placé dans ReplicatedStorage.

### L'autorité serveur pour les mouvements (fonction du moteur)
- Fait :
  - Distincte du principe « le serveur est la source de vérité » : sous autorité serveur, les clients n'envoient que leurs entrées et ne peuvent pas déclarer leur position ni leur état ; le client prédit, le serveur corrige.
  - La page la recommande pour les jeux compétitifs (tir, course, sport, combat).
- Source : https://create.roblox.com/docs/en-us/scripting/security/security-tactics.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : À envisager pour tout jeu de combat ou de course ; à décider avec le concepteur de jeu.

### Device Trust (option)
- Fait :
  - L'API Device Trust donne un niveau de confiance de l'appareil quand un joueur rejoint ; Roblox n'agit pas lui-même, le développeur choisit la réponse (lieux séparés, échanges restreints, refus).
  - Elle ne remplace pas les principes côté serveur : un appareil de confiance ne dispense pas de valider.
- Source : https://create.roblox.com/docs/en-us/scripting/security/security-tactics.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Non prévu pour l'instant ; garder en tête pour les jeux avec échanges entre joueurs.

## Non vérifié (à rechercher)

- Étapes précises de validation d'un RemoteEvent ou RemoteFunction : la page ne les détaille pas.
- Valeurs de limitation de débit (rate limiting) : non données par la page.
- Pages liées à lire : Network Ownership, Movement Validation, Physics Exploits, Access Control and Confidentiality.
