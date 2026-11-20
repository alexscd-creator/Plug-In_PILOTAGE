---
description: Démarrer un projet Pilotage avec une conversation guidée (nom, équipe, workflow, pôles, phases, agents), puis créer le dossier .pilotage.
argument-hint: "[nom du projet]"
---

# /demarrer

Démarre un projet Pilotage dans le dossier courant (le dossier de la session). Argument facultatif : `$ARGUMENTS` (nom du projet, à confirmer à l'étape 1).

## 1. Vérifier qu'il n'y a pas déjà un projet

Lancer :

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-projet.mjs" "<dossier courant>"
```

- Code 2 (`aucun projet`) : continuer.
- Code 0 (`projet ok`) ou code 1 (marqueur présent mais invalide) : il y a déjà un `.pilotage/projet.json` dans le dossier ou un parent. Le dire, ne rien écrire, ne jamais écraser, suggérer `/pilotage`, et s'arrêter.

## 2. Mener la conversation

Charger le skill `demarrage-guide` et le suivre, dans la conversation principale (jamais un sous-agent) : une question à la fois, les huit étapes dans l'ordre. Demander aussi qui est l'utilisateur actuel parmi l'équipe (pour `config.json`).

## 3. Écrire, seulement après la confirmation explicite

Aucune écriture avant le oui au récapitulatif. Le dossier du projet est le dossier courant. Créer :

1. `.pilotage/projet.json` : JSON indenté de 2 espaces, clés dans cet ordre : `version` (1), `nom`, `but`, `fini`, `preset`, `equipe`, `poles` (`id`, `titre`), `phases` (`id`, `titre`, `taches`), `agents` (`id`, `titre`, `pole`, `skills`, `pourquoi`), `workflow` (`outils` : liste de `role`, `outil`). Terminer par un saut de ligne. C'est le format de `serializeProjet` (`hooks/model/projet.ts`).
2. `.pilotage/plan.md` : format de `genererPlan` (`hooks/model/plan.ts`). Pour chaque phase, dans l'ordre : une ligne `## <titre de la phase> (<id de la phase>)`, une ligne vide, puis une ligne par tâche `- [ ] <id de la phase>-<n> | <titre de la tâche>` (n à partir de 1) ; une ligne vide entre deux phases ; un saut de ligne final.
3. `.pilotage/equipe/<prenom>/portes.md` pour chaque membre : fichier vide. `<prenom>` = le prénom en minuscules, sans accent ni espace (« Léa » donne `lea`, « Jean-Luc » donne `jean-luc`).
4. `.pilotage/agents/<id>.md` pour chaque agent : titre, rôle, pôle, pourquoi il est spécialisé, liste de ses skills (en précisant que certains peuvent ne pas être installés).
5. `~/.claude/pilotage/config.json` contenant `{"prenom": "<prénom de l'utilisateur actuel>"}`, **seulement s'il n'existe pas** (ne jamais le modifier s'il existe).
6. Si l'utilisateur l'a demandé à l'étape workflow : `~/.claude/pilotage/mon-workflow.json` (`{"outils": [{"role": "...", "outil": "..."}]}`), sans écraser un fichier existant sans son accord explicite.

Jamais de secret dans ces fichiers. Pas de git push, pas de publication externe.

## 4. Relire et vérifier

Relire chaque fichier écrit (existence et contenu conformes à ce qui a été confirmé), puis lancer :

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-projet.mjs" "<dossier courant>"
```

Attendu : `projet ok`. Sinon, afficher les erreurs, corriger le fichier concerné et relancer. Rapporter la liste des fichiers créés, puis suggérer de rouvrir le panneau avec `/pilotage`.
