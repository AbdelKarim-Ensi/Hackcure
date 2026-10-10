# `ai/` : assistant donneur (T16)

Service Python (FastAPI) indépendant du backend NestJS. Il répond aux questions des donneurs sur l'éligibilité, en **français, arabe et darija**, à partir d'une base de connaissances validée.

## Règles d'or (reprises de la fiche projet)

1. **Aucune décision médicale.** La compatibilité, l'éligibilité et le délai entre dons sont calculés par des règles déterministes (`backend/src/rules/`), jamais par ce service. L'éligibilité finale est confirmée par le personnel médical.
2. **Aucun diagnostic, aucun conseil personnel.** Le bot donne des informations générales et renvoie vers le personnel médical pour tout cas particulier.
3. **Il répond uniquement à partir de la base de connaissances validée**, avec la source citée. Hors base : il le dit, il n'invente pas.
4. **Un rappel (`disclaimer`) accompagne chaque réponse.**
5. **Aucune donnée de patient**, et aucune donnée de santé du donneur, n'est envoyée à ce service ni stockée.

## Lancer le service

```bash
cd ai
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest                                   # tests
uvicorn app.main:app --reload --port 8001
```

Documentation interactive : http://localhost:8001/docs

## Contrat (étape 1)

`GET /health` -> `{ "status": "ok", ... }`

`POST /chat`

```json
{ "message": "Puis-je donner si j'ai un tatouage ?", "language": "auto", "session_id": "optionnel" }
```

```json
{ "answer": "...", "language": "fr", "intent": "faq", "sources": [{"id": "...", "title": "..."}],
  "needs_staff": false, "disclaimer": "..." }
```

`language` : `fr`, `ar`, `darija` ou `auto`. `intent` : `faq`, `escalate`, `out_of_scope`, `emergency` (ou `stub` tant que le moteur n'existe pas).

## Base de connaissances (étape 2)

`data/knowledge_base.json` : 17 questions fréquentes, chacune en français, arabe et darija, avec des mots-clés pour la recherche (étape 3).

- Toutes les entrées sont `validated: false` : textes **provisoires**, à faire relire par un professionnel de santé et un locuteur de chaque langue.
- Tant qu'une entrée n'est pas validée, son texte ne contient **aucun chiffre** (durées, âges, poids). Un test le vérifie. Les chiffres vivent dans `backend/src/rules/`, et l'application les communique au donneur.
- Pour valider une entrée : renseigner `source` (document ou personne), puis passer `validated` à `true`. Le chargement refuse une entrée validée sans source.
- `needs_staff: true` : sujets que le bot ne tranche jamais (maladie chronique, traitement, hépatite, VIH).

## Feuille de route

| Étape | Contenu | État |
|---|---|---|
| 1 | Squelette, contrat d'API, tests | fait |
| 2 | Base de connaissances (FR / AR / darija, à valider) | fait |
| 3 | Recherche dans la base | à faire |
| 4 | Garde-fous : hors sujet, urgence, avis médical personnel | à faire |
| 5 | Détection de la langue et darija | à faire |
| 6 | Rédaction des réponses par un LLM (optionnelle) | à faire |
| 7 | Branchement sur le backend, Docker | à faire |
