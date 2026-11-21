---
name: avatars-et-animations
description: "Personnages, avatars et animations de Roblox (lecture d'animations, remplacement des animations par défaut, types de personnages), avec source et date. À charger avant de créer un personnage ou une animation."
---

# Avatars et animations

Faits lus dans la documentation officielle. Les priorités d'animation ne sont pas dans les pages lues.

**Règles d'usage.** Chaque entrée porte sa source et sa date de vérification. Un fait de plus de six mois est à revérifier. Ce qui n'est pas listé ici est « non vérifié » : fais-le vérifier par le chercheur-analyste du projet avant de t'y fier, n'invente rien.

## Entrées vérifiées

### Jouer une animation depuis un script
- Fait :
  - Pour un personnage à Humanoid : s'assurer que l'Humanoid contient un Animator, créer une instance Animation avec son AnimationId, la charger avec Animator:LoadAnimation() pour obtenir une AnimationTrack, puis la jouer avec AnimationTrack:Play().
  - Pour un personnage sans Humanoid : créer un AnimationController avec un Animator enfant, puis charger et jouer de la même façon.
  - AnimationTrack:GetMarkerReachedSignal() permet de réagir à un événement d'animation (exemple de la page : « KickEnd »).
- Source : https://create.roblox.com/docs/en-us/animation/using.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Une animation se joue côté client pour le joueur local ; toute conséquence de jeu qu'elle déclenche (dégâts, gains) est décidée par le serveur.

### Remplacer les animations par défaut
- Fait :
  - Les personnages de joueurs ont par défaut des animations de course, marche, saut, chute, escalade, nage et repos. Elles sont lues par le script « Animate » du personnage (chemins : run.RunAnim, walk.WalkAnim, jump.JumpAnim, idle.Animation1 et Animation2, fall.FallAnim, swim.Swim, swimidle.SwimIdle, climb.ClimbAnim).
  - Méthode de la page : récupérer l'identifiant d'asset (Animation Editor ou catalogue), ajouter un Script dans ServerScriptService, attendre CharacterAppearanceLoaded, arrêter les pistes en cours (GetPlayingAnimationTracks puis Stop) et modifier les valeurs du script Animate.
  - Plusieurs animations pour un même état : le script Animate en tire une au hasard, selon le poids (poids de l'animation divisé par le total des poids de l'état).
- Source : https://create.roblox.com/docs/en-us/animation/using.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Pour donner une identité à un jeu, remplacer les animations par défaut côté serveur au chargement du personnage.

### Types de personnages
- Fait :
  - Un personnage est un Model, humanoïde ou non, qui bouge, communique et interagit. Deux types : personnages de joueurs et personnages non joueurs (PNJ).
  - Un PNJ est contrôlé par le jeu (allié, ennemi, vie ambiante) et n'a souvent besoin que d'une ou deux tâches simples ; le plus simple est un Model avec de la géométrie et des scripts, souvent avec un Humanoid.
  - Un avatar standard demande notamment 15 MeshPart de corps nommés selon la norme, une armature de rig, un Humanoid, un objet FaceControls (au moins 17 poses de base du visage), 15 WrapTarget et 19 Attachment ; le R15 standard compte 15 articulations posables (jusqu'à 37 de plus en R15 avancé).
  - Outils cités : Animation Editor, Adaptive Animation (relie un rig personnalisé à l'armature standard), Animation Graph Editor (mélanges et machines à états), Character Controller Library (remplacement du comportement par défaut de l'Humanoid, activé dans les réglages d'avatar), SLIM (versions optimisées d'avatars, exige le streaming d'instances).
- Source : https://create.roblox.com/docs/en-us/characters
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Pour les ennemis et PNJ, partir du modèle le plus simple qui suffit ; vérifier chaque animation en la jouant avant de la déclarer finie.

## Non vérifié (à rechercher)

- Priorités d'animation (AnimationPriority) : non dites par les pages lues.
- Différences R6 et R15 détaillées, coût des PNJ en performance : non données.
- Règles de modération des avatars et des contenus : page non lue.
