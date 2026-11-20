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

Les fichiers du projet ne s'écrivent **jamais à la main** : le script `ecrire-projet.mjs` les produit avec les vrais sérialiseurs du modèle (échappement, identifiants, noms de dossier sûrs). Ne pas écrire à la main `projet.json`, `plan.md` ni les fichiers d'agents.

1. Écrire les réponses confirmées dans un fichier JSON temporaire (dossier du scratchpad de la session ou dossier temporaire du système, jamais dans le projet) : `{"nom", "but", "fini", "preset", "equipe": [...], "poles": [{"id","titre"}], "phases": [{"id","titre","taches":[...]}], "agents": [{"id","titre","pole","skills":[...],"pourquoi"}], "workflow": {"outils": [{"role","outil"}]}}`. Les identifiants de pôles, phases et agents : minuscules, chiffres et tirets seulement.
2. Lancer : `node "${CLAUDE_PLUGIN_ROOT}/scripts/ecrire-projet.mjs" "<dossier courant>" "<reponses.json>"`. Codes de sortie : 0 écrit ; 1 réponses invalides (erreurs affichées, rien n'est écrit : corriger avec l'utilisateur et relancer) ; 3 un projet existe déjà (s'arrêter) ; 4 écriture impossible (rien n'est resté, tout ce qui avait été créé est retiré : dire le message à l'utilisateur) ; 5 dossier introuvable ou qui n'est pas un dossier (rien n'est créé) ; 64 usage incorrect (mauvais arguments).

Le script crée `.pilotage/projet.json`, `.pilotage/plan.md`, `.pilotage/equipe/<prenom>/portes.md` (vide ; `<prenom>` = prénom en minuscules, sans accent, caractères spéciaux remplacés par des tirets) et `.pilotage/agents/<id>.md`. Il refuse d'écraser un projet existant.

Puis, à la main, uniquement ces deux fichiers personnels :

- `~/.claude/pilotage/config.json` contenant `{"prenom": "<prénom de l'utilisateur actuel>"}`, **seulement s'il n'existe pas** (ne jamais le modifier s'il existe). Le prénom doit être un nom simple (lettres, espaces, tirets), sans guillemet ni barre oblique ; sinon le redemander.
- Si l'utilisateur l'a demandé à l'étape workflow : `~/.claude/pilotage/mon-workflow.json` (`{"outils": [{"role": "...", "outil": "..."}]}`), sans jamais écraser un fichier existant sans son accord explicite.

Jamais de secret dans ces fichiers. Pas de git push, pas de publication externe.

## 4. Relire et vérifier

Relire chaque fichier écrit (existence et contenu conformes à ce qui a été confirmé), puis lancer :

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-projet.mjs" "<dossier courant>"
```

Attendu : `projet ok`. Sinon, afficher les erreurs, corriger le fichier concerné et relancer. Rapporter la liste des fichiers créés, puis suggérer de rouvrir le panneau avec `/pilotage`.
