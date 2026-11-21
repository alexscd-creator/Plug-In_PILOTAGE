---
name: environnement-et-modeles
description: Terrain et streaming d'instances de Roblox (outils, limites, réglages), avec source et date. À charger avant de construire un grand décor.
---

# Environnement et modeles

Faits lus dans la documentation officielle. Les assets de la boutique et les modèles ne sont pas encore documentés ici.

**Règles d'usage.** Chaque entrée porte sa source et sa date de vérification. Un fait de plus de six mois est à revérifier. Ce qui n'est pas listé ici est « non vérifié » : fais-le vérifier par le chercheur-analyste du projet avant de t'y fier, n'invente rien.

## Entrées vérifiées

### Terrain
- Fait :
  - Le terrain est fait de voxels (régions de 4×4×4 studs, un matériau chacune). Outils : Generate (biomes : Arctic, Dunes, Canyons, Lavascape, Water, Mountains, Hills, Plains, Marsh), Import (carte de hauteurs et carte de couleurs facultative), et script via les méthodes Fill (FillBall, FillBlock, FillCylinder, FillRegion, FillWedge).
  - Carte de hauteurs : 1 pixel = 4 studs, 4096×4096 au maximum, en .jpg ou .png. Les couleurs de la carte de couleurs doivent correspondre aux valeurs RGB de la page ; une couleur inconnue prend le matériau le plus proche.
  - Pinceaux : taille de base de 1 à 64 studs, formes sphère, boîte, cylindre. Outils d'édition : Select, Transform, Fill/Replace, Sea Level.
  - Les matériaux de terrain personnalisés demandent d'activer Expanded Terrain. Seuls l'herbe (Grass) et l'eau (Water) s'animent ; Terrain.Decoration doit être activé pour l'herbe animée (GrassLength de 0,1 à 1).
  - Propriétés de l'eau sur Workspace.Terrain : WaterColor, WaterReflectance, WaterTransparency, WaterWaveSize, WaterWaveSpeed ; certaines ne s'affichent qu'en test de jeu si la qualité d'édition de Studio n'est pas relevée.
- Source : https://create.roblox.com/docs/en-us/parts/terrain.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Prévoir le terrain par carte de hauteurs pour de grandes zones, et noter la taille de la carte et les biomes dans la fiche.

### Streaming d'instances (Workspace.StreamingEnabled)
- Fait :
  - Le moteur charge et décharge le contenu 3D du Workspace par région : jointure plus rapide, moins de mémoire, meilleures performances. StreamingEnabled est activé par défaut pour les nouveaux lieux et ne se règle pas par script.
  - Seuls les descendants du Workspace sont concernés : ReplicatedStorage et ReplicatedFirst ne sont pas éligibles.
  - Réglages de la page : ModelStreamingBehavior Legacy (défaut) ou Improved (recommandé) ; StreamingMinRadius 64 (recommandé) ; StreamingTargetRadius 1024 (recommandé, plus grand que le minimum) ; StreamOutBehavior LowMemory (défaut) ou Opportunistic (recommandé) ; StreamingIntegrityMode PauseOutsideLoadedArea (recommandé).
  - Modèles : ModelStreamingMode Nonatomic (défaut), Atomic (tout le modèle arrive ensemble : utiliser WaitForChild), Persistent (jamais déchargé, à utiliser rarement), PersistentPerPlayer.
  - Un objet déchargé passe à parent nil côté client : ChildRemoved ou DescendantRemoving se déclenchent chez son parent, et des changements purement locaux peuvent être perdus.
  - La physique (prédiction comprise) ne tourne que dans les zones chargées ; un point de réplication supplémentaire (ReplicationFocus) ajoute de la charge serveur (neuf foyers mobiles coûtent à peu près autant que dix joueurs, selon la page).
  - Débogage : surcouche Network Stats (Maj+F3), panneau Streaming avec zones colorées.
- Source : https://create.roblox.com/docs/en-us/workspace/streaming.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Garder StreamingEnabled ; du code client ne doit jamais supposer qu'une pièce lointaine existe (WaitForChild, objets Atomic pour les ensembles) ; tester en parcourant la carte.

## Non vérifié (à rechercher)

- Modèles, maillages et assets de la boutique : règles d'usage et licences, non lues.
- Coûts de performance chiffrés d'un grand décor : non donnés par les pages lues.
- Pages liées non lues : matériaux de terrain personnalisés, niveaux de détail (vidéo).
