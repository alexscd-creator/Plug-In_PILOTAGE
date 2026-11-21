---
description: Valider la porte d'une phase (porte), avancer sans attendre l'autre (forcer) ou répondre « pas encore » (repondre), avec confirmation.
argument-hint: "[porte|forcer|repondre] <phase>"
---

# /phase

Argument : `$ARGUMENTS`, soit `[porte|forcer|repondre] <identifiant de phase>`. Sans mode, c'est `porte`. Si la phase est absente, lister les phases de `.pilotage/projet.json` et demander laquelle.

Charger le skill `chantier-pilotage`, dans la conversation principale. Les portes ne s'écrivent **jamais à la main** : `node "${CLAUDE_PLUGIN_ROOT}/scripts/pilotage-chantier.mjs" "<dossier courant>" porte <json> --membre "<prénom>"`, avec le prénom lu dans `~/.claude/pilotage/config.json` (il doit être dans l'équipe de `projet.json`). Le script écrit `.pilotage/equipe/<prénom>/portes.md` ; on n'écrit que chez soi.

Vérifier d'abord le projet : `node "${CLAUDE_PLUGIN_ROOT}/scripts/check-projet.mjs" "<dossier courant>"` doit répondre `projet ok`.

## porte : valider la porte

1. Lire `.pilotage/plan.md` et le projet : la porte n'est possible que si `portePossible` est ok pour la phase, c'est-à-dire qu'aucune tâche de la phase n'est « a faire » ou « en cours ». Le script refuse sinon (code 1) et liste les tâches ouvertes.
2. Tâches ouvertes : les montrer, et laisser l'utilisateur choisir pour chacune : terminer, reporter ou abandonner. Appliquer ses choix avec l'action `tache` du script (`{"id": "<id de la tâche>", "statut": "termine|reporte|abandonne"}`), une tâche à la fois. Le plan est partagé : il se modifie une personne à la fois, et un conflit éventuel est réglé par Git. Ne jamais cocher une tâche de sa propre initiative.
3. Quand la porte est possible, **demander confirmation** : « Valider la porte de la phase <phase> ? ». Après le oui, lancer l'action `porte` avec `{"phase": "<phase>", "mode": "valider"}` et rapporter le message du script.

## forcer : avancer sans attendre l'autre membre

Réservé au cas où l'autre membre n'a pas validé et où l'utilisateur veut avancer quand même. Ne se force jamais en silence : expliquer ce que cela veut dire (la porte est marquée franchie « sans l'autre », et le panneau l'affiche comme telle), **demander confirmation** explicite, puis seulement lancer `porte` avec `{"phase": "<phase>", "mode": "forcer"}` et `--confirme`. Les tâches de la phase doivent aussi être réglées (même règle que `porte`).

## repondre : « pas encore »

Pour répondre à la proposition de l'autre membre. Demander la note à lui transmettre et la **confirmation** de l'utilisateur, puis lancer `porte` avec `{"phase": "<phase>", "mode": "repondre", "note": "<note>"}` et `--confirme`.

Dans tous les cas, sans confirmation explicite pour `forcer` et `repondre`, ne pas passer `--confirme` : le script refuse alors d'écrire. Rien n'est validé ni forcé sans que l'utilisateur l'ait dit.
