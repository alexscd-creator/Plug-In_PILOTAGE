---
description: Créer un chantier (contrôle d'impact, fiche, sous-session proposée), l'ouvrir dans sa sous-session (ouvrir <id>) ou le clore avec sa passation (clore <id>).
argument-hint: "<nom du chantier> | ouvrir <id> | clore <id>"
---

# /pilotage:chantier

Argument : `$ARGUMENTS`. S'il est vide, demander le nom du chantier. Selon le premier mot : `ouvrir <id>`, `clore <id>`, ou sinon la création d'un chantier qui s'appelle `$ARGUMENTS`.

Dans tous les cas, charger le skill `chantier-pilotage` et le suivre, dans la conversation principale. Les fiches ne s'écrivent **jamais à la main** : toujours `node "${CLAUDE_PLUGIN_ROOT}/scripts/pilotage-chantier.mjs" "<dossier courant>" <action> <json> --membre "<prénom>"` (voir le skill pour les données de chaque action et les codes de sortie).

## 0. Vérifier le projet et le membre

1. Lancer `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-projet.mjs" "<dossier courant>"`. Autre chose que `projet ok` : le dire et s'arrêter (`/pilotage:demarrer` crée le projet).
2. Lire le prénom dans `~/.claude/pilotage/config.json` (`{"prenom": "..."}`). Absent ou absent de l'équipe de `.pilotage/projet.json` : le dire, demander lequel des membres de l'équipe est l'utilisateur, et ne rien écrire avant sa réponse.

## 1. Créer un chantier (`/pilotage:chantier <nom>`)

1. **Contrôle d'impact.** Appeler l'agent `pilotage:chef-de-chantier` (celui de ce plugin, avec son préfixe) (lecture seule, il ne lance aucun script) avec le nom du chantier : il rend les pôles et agents concernés, les fichiers touchés, les chevauchements avec les autres chantiers, et une liste de tâches proposées.
2. **Demander confirmation.** Montrer à l'utilisateur le récapitulatif (titre, pôle, phase, agents, tâches, fichiers, chevauchements) et demander : « Créer ce chantier ? ». Le corriger avec lui autant que nécessaire. Sans un oui explicite, rien n'est écrit.
3. **Écrire par le script.** Écrire les données confirmées dans un fichier JSON temporaire (jamais dans le projet) puis lancer l'action `creer`. Le script refuse d'écraser une fiche existante (code 3 : proposer un autre identifiant) et dit ce qu'il refuse (code 1 : corriger avec l'utilisateur et relancer). Ne jamais contourner une erreur en écrivant la fiche à la main.
4. **Proposer la sous-session.** Le chantier peut être mené dans une sous-session dédiée. Elle n'est jamais lancée automatiquement : c'est l'utilisateur qui choisit.
   - Si l'outil `mcp__ccd_session__start_session` est disponible : l'appeler **seul dans son message**, avec `initiation: "offer"` et `title: "Chantier : <nom>"`. L'application montre la carte « Nouvelle session / Faire ici » et attend le choix.
   - **Nouvelle session choisie** : rappeler l'outil avec le `proposal_id` reçu, `context: "fresh"`, `use_worktree: false`, `name: "<id du chantier>"` et un `prompt` qui **commence par** `/pilotage:chantier ouvrir <id>`, suivi d'un bref résumé : le projet (nom, objectif), le chantier (titre, tâches), le chemin de la fiche, le prénom du membre, et les règles (on n'écrit que chez soi, fiches par le script seulement, confirmation avant toute action). Dire ensuite que la sous-session est ouverte et où la retrouver.
   - **« Faire ici »** ou pas de réponse : continuer dans cette session, avec les étapes de la section 2.
   - **Outil absent** (terminal, autre application) : dire que la sous-session ne peut pas être créée d'ici, et donner la marche à suivre : ouvrir une nouvelle session dans le projet et y taper `/pilotage:chantier ouvrir <id>`.
5. Rappeler que `/projet` (le panneau) montre le chantier dans le panneau.

## 2. Ouvrir un chantier (`/pilotage:chantier ouvrir <id>`)

Première commande d'une sous-session, ou reprise d'un chantier existant.

1. Lire la fiche `.pilotage/equipe/<prénom>/chantiers/<id>.md` (prénom en minuscules, sans accent, tirets). Introuvable : lister les fiches du membre et s'arrêter. Il ne faut jamais en créer une autre en silence.
2. **Lier la session.** La section « Projet Pilotage » de tes consignes donne la ligne « Identifiant de cette session : <identifiant> ». Lancer l'action `lier-session` avec `{"id": "<id>"}` et l'option `--session-id <identifiant>` (exactement celui de cette ligne ; ne jamais en inventer ni en recopier un autre). C'est ce lien (`sessions.json`) qui affiche le bandeau du chantier et tient à jour les états des agents dans la fiche. Seulement si cette ligne est absente : lancer `lier-session` avec `{"id": "<id>", "nom": "<nom de la session>"}`, et le chantier est alors retrouvé par le nom de sous-session (sans bandeau ni états en direct).
3. Lancer l'action `maj` avec `{"id": "<id>", "etat": "en-travail"}`.
4. Résumer la fiche en cinq lignes (où en est le chantier, fini, reste, bloque, prochain pas), puis travailler avec les agents de la fiche. Au fil du travail, tenir la fiche à jour avec `maj` (tâche terminée, fichier touché, agent, état) : une action de suivi à la fois, et rapporter le message du script.

## 3. Clore un chantier (`/pilotage:chantier clore <id>`)

1. Lire la fiche. Lister les tâches « a faire » ou « en cours » : pour chacune, l'utilisateur choisit terminer, reporter ou abandonner (`maj`, ou `tache` pour le plan partagé). `--force-report` (tout ce qui reste passe à « reporte ») n'est utilisé que si l'utilisateur le demande explicitement.
2. Rédiger la **passation** (fait, reste et pourquoi, décisions, fichiers touchés, premier pas pour reprendre) et la montrer à l'utilisateur.
3. **Demander confirmation** : « Archiver le chantier avec cette passation ? ». Sans un oui explicite, ne rien archiver.
4. Lancer l'action `archiver` avec `{"id": "<id>", "passation": "<texte>"}` (avec `--force-report` si accordé). Rapporter le résultat : la fiche est déplacée dans `archive/`.
5. Archiver ou fermer la sous-session elle-même reste un geste de l'utilisateur : le proposer, ne jamais le faire.
