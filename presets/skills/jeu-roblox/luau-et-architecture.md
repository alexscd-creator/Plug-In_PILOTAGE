---
name: luau-et-architecture
description: "Architecture client-serveur d'un jeu Roblox et organisation des scripts en Luau, avec source et date. À charger avant d'écrire ou d'organiser du code."
---

# Luau et architecture

Ce skill ne contient que des faits lus dans la documentation officielle ; le langage Luau lui-même reste à documenter.

**Règles d'usage.** Chaque entrée porte sa source et sa date de vérification. Un fait de plus de six mois est à revérifier. Ce qui n'est pas listé ici est « non vérifié » : fais-le vérifier par le chercheur-analyste du projet avant de t'y fier, n'invente rien.

## Entrées vérifiées

### Le modèle client-serveur
- Fait :
  - Les jeux Roblox sont multijoueurs par défaut et fonctionnent en client-serveur ; le serveur est l'autorité ultime sur l'état du jeu et garde tous les clients synchronisés.
  - Au lancement, Roblox copie le modèle de données « édition » publié depuis Studio et l'exécute sur ses serveurs comme modèle de données « exécution » ; les clients connectés reçoivent aussi une copie.
  - L'initialisation du joueur (sac à dos, interface locale) se fait côté client.
  - Si Workspace.StreamingEnabled est vrai, le serveur n'envoie d'abord que la partie du Workspace la plus proche du client.
- Source : https://create.roblox.com/docs/en-us/projects/client-server.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Le code qui décide (règles, gains, données) va au serveur ; le client gère l'affichage et l'interface.

### La réplication
- Fait :
  - La réplication synchronise le serveur et les clients : modèle de données, simulation physique, messages de discussion.
  - Les changements sont répliqués quand un script modifie quelque chose qui doit apparaître de l'autre côté de la frontière client-serveur.
  - Trois flux : client vers serveur ; serveur vers un client ; serveur vers tous les clients.
  - Physique : toutes les pièces sont des corps rigides simulés ; Roblox peut confier la propriété d'un assemblage à un client ou au serveur (en général automatique, modifiable).
  - Discussion : le serveur filtre les messages et décide lesquels sont répliqués.
  - Dans Studio, le test se fait par défaut sans latence ; les réglages de simulation réseau ajoutent un délai (la page suggère 50 à 150 ms dans les deux sens ; la plupart des joueurs voient 100 à 300 ms).
- Source : https://create.roblox.com/docs/en-us/projects/client-server.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Tester les jeux avec de la latence simulée avant de les déclarer finis.

## Non vérifié (à rechercher)

- Où placer les scripts (ServerScriptService, StarterPlayerScripts, ReplicatedStorage) : la page lue ne le dit pas.
- RemoteEvent et RemoteFunction : non nommés par la page lue.
- Le langage Luau (types, bonnes pratiques, performances) : aucune page lue pour l'instant.
