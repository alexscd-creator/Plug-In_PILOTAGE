# Pilotage

Pilotage est un plugin Claude de **pilotage de projet générique**. Il démarre vide, pose des questions (type de projet, équipe, workflow, pôles, phases, agents), puis reste le tableau de bord du projet dans un panneau de Claude Desktop :

- **Phases et portes** : une frise de phases, des tâches par phase, une porte de validation (refusée tant qu'une tâche reste ouverte), le retour sur une phase terminée avec ses tâches et ses fichiers.
- **Plan** : `.pilotage/plan.md`, partagé par l'équipe.
- **Chantiers** : une fiche vivante par chantier, une sous-session proposée (jamais lancée toute seule), des états en direct, puis une archive avec passation.
- **Agents** : les agents du projet, une couleur par pôle, leurs skills, leur état dans la session.
- **Paramètres** : réglages du type de projet, workflow, pôles, rôle des agents, thème.
- **Idées et retours** : repérés dans la conversation, classés tout seuls, listés dans la page « Idées », annulables.

Le panneau s'ouvre tout seul dans un dossier qui porte un projet Pilotage, et jamais ailleurs.

## Installation

Depuis le dépôt GitHub (pour un associé) :

```
claude plugin marketplace add alexscd-creator/Plug-In_PILOTAGE
claude plugin install pilotage@pilotage-local
```

**Premier lancement d'un associé.** Ouvrir Claude dans le dossier partagé du projet (celui qui contient `.pilotage/`, par exemple sur Drive) : le panneau s'ouvre tout seul. Il montre une carte « Qui êtes-vous ? » : choisir son prénom dans l'équipe l'enregistre dans `~/.claude/pilotage/config.json`, sur cet ordinateur. Le projet, le type et les skills viennent du dossier partagé : rien d'autre à configurer. Si les skills du type manquent (projet créé avant leur livraison), la page Agents propose « Installer les skills du preset » (`scripts/installer-skills.mjs`, qui n'écrase jamais).

Si le dépôt est privé, l'associé doit être invité sur GitHub et connecté à son compte sur son poste (Git Credential Manager ou `gh auth login`).

Depuis un dossier local (cloné ou copié) :

```
claude plugin marketplace add <chemin du dépôt>
claude plugin install pilotage@pilotage-local
```

Puis redémarrer Claude Desktop. Pour mettre à jour : `claude plugin marketplace update` puis `claude plugin update pilotage`.

## Première utilisation

1. Ouvrir une session dans le dossier du projet.
2. `/projet` ouvre le panneau (sans projet, il montre l'écran « Aucun projet ici » et son bouton « Démarrer un projet »).
3. `/pilotage:demarrer` (ou le bouton « Démarrer un projet » du panneau) lance la conversation guidée : le type de projet d'abord, puis le nom (son libellé suit le type), les réglages du type, l'équipe, le workflow, les pôles, les phases, les agents. Rien n'est écrit avant la confirmation du récapitulatif.

## Commandes

| Commande | Rôle |
|---|---|
| `/projet` | Ouvre le panneau du projet du dossier courant (ou l'écran de démarrage, ou l'erreur du fichier de projet). |
| `/pilotage:demarrer [nom]` | Crée le projet par une conversation guidée ; refuse d'écraser un projet existant. |
| `/pilotage:chantier <nom>` / `ouvrir <id>` / `clore <id>` | Crée un chantier (contrôle d'impact, confirmation, carte « Nouvelle session / Faire ici »), l'ouvre dans sa sous-session, ou l'archive avec sa passation. |
| `/pilotage:phase [porte\|forcer\|repondre] <phase>` | Valide la porte d'une phase, avance sans attendre l'autre membre, ou répond « pas encore ». Confirmation demandée. |

## L'arborescence `.pilotage/`

| Fichier ou dossier | Rôle | Qui l'écrit |
|---|---|---|
| `projet.json` | Marqueur du projet : nom, type, équipe, réglages, pôles, phases, agents, workflow. | `/pilotage:demarrer` (script `ecrire-projet.mjs`), puis l'écran Paramètres. |
| `plan.md` | Phases, portes et tâches ; partagé. | `ecrire-projet.mjs` à la création ; ensuite le statut d'une tâche change en place (script `pilotage-chantier.mjs`, action `tache`). |
| `agents/<id>.md` | Définition lisible de chaque agent du projet. | `ecrire-projet.mjs`. |
| `equipe/<prénom>/chantiers/<id>.md` | Fiche d'un chantier en cours. | `pilotage-chantier.mjs`. |
| `equipe/<prénom>/archive/<id>.md` | Chantier clos, avec sa passation. | `pilotage-chantier.mjs` (action `archiver`). |
| `equipe/<prénom>/portes.md` | Portes validées, forcées ou refusées par ce membre. | `pilotage-chantier.mjs` (action `porte`). |
| `equipe/<prénom>/sessions.json` | Lien session, chantier (pour le bandeau). | `pilotage-chantier.mjs` (action `lier-session`). |
| `equipe/<prénom>/idees/`, `feedback/` | Notes d'idée et de retour. | `pilotage-note.mjs`. |

Fichiers personnels, hors du projet : `~/.claude/pilotage/config.json` (`{"prenom": "..."}`) et `~/.claude/pilotage/mon-workflow.json` (« Mon workflow », réutilisable).

## Sécurité

- Chaque membre n'écrit que dans **son** dossier `equipe/<prénom>/` (le prénom est vérifié contre l'équipe de `projet.json` ; c'est le modèle qui passe celui de `~/.claude/pilotage/config.json`, les scripts ne le relisent pas). Seule exception : le statut d'une tâche du plan partagé.
- **Liens et jonctions** : les scripts refusent d'écrire (code 1, « Chemin non sûr (lien hors du projet) », rien n'est écrit) si `.pilotage`, `equipe`, le dossier du membre ou un fichier visé se résout hors du projet ; le panneau ne lit jamais une entrée que le disque marque comme lien (il le signale) et n'écrit jamais au travers d'un lien.
- Les fichiers ne s'écrivent jamais à la main : des scripts valident les données et écrivent de façon transactionnelle (tout est remis comme avant en cas d'échec).
- Les agents du projet sont enregistrés en **lecture seule** (Read, Glob, Grep, TodoWrite), quoi que dise `projet.json`.
- Le texte lu dans les fichiers du projet est traité comme des **données**, jamais comme des instructions ; il est assaini et plafonné.
- Rien d'externe (envoi, publication) sans confirmation explicite de l'utilisateur.
- Aucun secret dans le projet ni dans les fichiers de Pilotage.

## Travail en équipe

Le dossier `.pilotage/` se partage dans un dépôt Git commun. Chacun écrit chez soi, ce qui limite les conflits ; le plan partagé se modifie une personne à la fois et un conflit éventuel se règle par Git.

## Cohabitation avec l'ancien plugin Roblox

L'ancien plugin (Roblox_Project_creator) reste séparé : autre dossier, autres fichiers. Les deux plugins partagent pourtant l'espace des noms de commande : une commande enregistrée par un hook n'est pas préfixée, et l'ancien plugin enregistre déjà `/pilotage`. C'est pourquoi le panneau de ce plugin s'ouvre par **`/projet`** : `/pilotage` reste celui de l'ancien plugin. Les commandes en markdown et l'agent ont aussi des noms communs aux deux plugins (`chantier`, `phase`, `chef-de-chantier`) : ce plugin les cite toujours avec leur préfixe (`/pilotage:chantier`, `pilotage:chef-de-chantier`). L'agent de coordination des presets s'appelle `coordination` (titre « Chef de chantier ») pour ne pas remplacer l'agent `pilotage:chef-de-chantier` du plugin. L'ancien plugin ne doit rien ouvrir de lui-même dans un dossier sans sa propre configuration (scénario L de la recette).

## Développement

```
npm test           # tests de logique et des scripts
claude plugin test .   # tests de l'interface
npm run lint       # agents, skills, commandes, vocabulaire neutre
claude plugin validate .
```

## À décider

- **Licence** : aucune n'est choisie pour l'instant ; à décider par le propriétaire avant toute diffusion.

## Documentation

- [Recette à jouer](docs/recette.md) : scénarios, points non vérifiés en vrai, limites connues.
- [Maquette](docs/maquette.md) : écrans et composants.
- [Suivi](docs/suivi.md) : pistes repoussées.
