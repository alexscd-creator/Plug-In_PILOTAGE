---
name: donnees-et-datastore
description: Bonnes pratiques officielles des DataStores de Roblox (sauvegarde, erreurs, structure des clés), avec source et date. À charger avant de toucher aux données des joueurs.
---

# Donnees et datastore

Les données des joueurs sont sensibles : toute écriture sur elles est une grosse tâche (accord de l'utilisateur d'abord).

**Règles d'usage.** Chaque entrée porte sa source et sa date de vérification. Un fait de plus de six mois est à revérifier. Ce qui n'est pas listé ici est « non vérifié » : fais-le vérifier par le chercheur-analyste du projet avant de t'y fier, n'invente rien.

## Entrées vérifiées

### Limiter et espacer les requêtes
- Fait :
  - Charger les données d'un joueur au début de sa session, garder une copie locale au serveur et la mettre à jour, plutôt que d'envoyer une requête à chaque changement.
  - Sauvegarder périodiquement, quand le joueur part, quand le serveur s'arrête et aux points critiques (traitement d'un achat).
  - L'intervalle de sauvegarde périodique reste dans les limites de requêtes et plus court que toute expiration de verrou de session ; l'exemple de la page utilise 180 secondes.
  - Ne pas lancer des requêtes récurrentes depuis tous les serveurs au même moment : décalage initial aléatoire, ou variation aléatoire bornée.
  - Répartir une clé très lue (« sharding ») seulement pour une limitation de lecture par clé, après avoir réduit les requêtes inutiles ; cela ne règle pas la limitation d'écriture.
  - Open Cloud et les serveurs de jeu partagent le même budget de requêtes de l'expérience.
- Source : https://create.roblox.com/docs/en-us/cloud-services/data-stores/best-practices.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Une seule lecture au départ et des sauvegardes espacées ; jamais de sauvegarde à chaque changement.

### Erreurs et nouvelles tentatives
- Fait :
  - Envelopper les requêtes dans pcall et retenter les échecs passagers avec un délai exponentiel.
  - Ajouter une variation aléatoire à chaque délai et plafonner le délai et le nombre d'essais.
  - Ne pas retenter une requête invalide ou une opération devenue inutile.
  - Traiter les nouvelles tentatives dans l'ordre pour chaque clé : une ancienne requête retentée après une plus récente peut écraser des données plus neuves.
  - Un appel échoué signifie qu'aucune réponse n'a été reçue, mais l'écriture peut avoir réussi côté serveur : traiter ce cas avec prudence.
  - Préférer UpdateAsync à SetAsync quand l'écriture dépend de la valeur actuelle ou que plusieurs serveurs écrivent la même clé ; SetAsync pour créer une clé ou remplacer une valeur indépendante de l'ancienne.
- Source : https://create.roblox.com/docs/en-us/cloud-services/data-stores/best-practices.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Tout accès aux DataStores passe par un petit module commun avec pcall, délais et plafonds ; jamais d'appel isolé.

### Structure des données et des clés
- Fait :
  - Utiliser un petit nombre fixe de data stores et organiser par clés (comme des tables) : un seul PlayerData, pas un par joueur.
  - Une clé par joueur si les données tiennent dans la limite de 4 Mo par objet ; garder ensemble ce qui doit changer d'un bloc.
  - Clés construites avec des identifiants stables (par exemple User_{UserId}), jamais avec un nom d'affichage.
  - Préfixes pour grouper les clés ; la portée (scope) ajoute une chaîne devant chaque clé ; portée par défaut : global.
  - Utiliser les versions de data store plutôt que de nouvelles clés par révision ; seule la dernière version compte pour le stockage.
  - Les memory stores servent aux données temporaires qui changent vite (elles expirent).
  - DataStore2 est un module ancien à ne pas utiliser pour une nouvelle expérience.
  - Supprimer les données de test et celles des fonctionnalités retirées ; un data store marqué à supprimer peut être restauré pendant 30 jours.
- Source : https://create.roblox.com/docs/en-us/cloud-services/data-stores/best-practices.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Une clé User_<id> par joueur, schéma décrit dans la fiche du chantier, données de test nettoyées en fin de chantier.

### Suivi et droit à l'effacement
- Fait :
  - Surveiller avec le tableau de bord d'observabilité des data stores et des alertes ; inspecter avec Data Stores Manager.
  - Configurer le traitement automatisé du droit à l'oubli pour les données à clés statiques ; sinon utiliser le webhook de droit à l'effacement.
- Source : https://create.roblox.com/docs/en-us/cloud-services/data-stores/best-practices.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Prévoir l'effacement des données d'un joueur dès la conception du schéma (jeux avec jeunes joueurs).

## Non vérifié (à rechercher)

- Verrouillage de session (session locking) : la page n'a pas de section dédiée, seulement la règle sur l'intervalle de sauvegarde.
- Quotas et limites de débit chiffrés : renvoyés à la page des codes d'erreur et limites, non lue.
- Détail de la sauvegarde à la sortie du joueur et à l'arrêt du serveur (BindToClose) : non détaillé par la page.
