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

## Recherche (étape 3)

`app/search.py` : recherche **déterministe, sans modèle ni clé d'API**. Pour chaque entrée et chaque langue, les mots de la question sont comparés aux mots-clés (poids 3), à la question type (2) et à la réponse (1). Un mot rare dans la base compte plus qu'un mot courant ; les mots interrogatifs (« comment », « كيفاش »...) comptent peu ; les fautes de frappe légères sont tolérées. Le score est dans [0, 1] et la réponse n'est donnée qu'à partir de **0,35** (`CONFIDENCE_THRESHOLD`). En dessous, le bot le dit et renvoie vers le personnel médical.

`app/normalize.py` : minuscules, accents français retirés, écritures arabes unifiées (hamza, voyelles courtes, ڨ tunisien), article « ال » et préfixes « بال » retirés.

`/chat` : question reconnue -> `intent: faq` (ou `escalate` si l'entrée est `needs_staff`) avec la source ; sinon `intent: out_of_scope`. Langue `auto` : lettres arabes -> darija, sinon français (affinée à l'étape 5).

### Qualité mesurée

`tests/golden_queries.json` : 47 questions attendues et 22 hors sujet. Résultat actuel : **bonne réponse en tête 45/47**, présente dans le top 3 **47/47**, hors sujet refusé **21/22**. Le seuil est volontairement prudent : mieux vaut renvoyer vers le personnel médical que répondre à côté. **Ajoutez de vraies questions de donneurs** à ce fichier : un test échoue si ces mesures baissent.

### Limites connues
- Le darija écrit en lettres latines (« nejem netbarra3 ? ») n'est pas compris.
- Une question hors sujet qui partage un mot avec la base peut passer (ex. « quel temps fait-il » et le mot « temps »). L'étape 4 ajoute un contrôle de domaine.
- Aucune compréhension du contexte : chaque message est traité seul.

## Feuille de route

| Étape | Contenu | État |
|---|---|---|
| 1 | Squelette, contrat d'API, tests | fait |
| 2 | Base de connaissances (FR / AR / darija, à valider) | fait |
| 3 | Recherche dans la base | fait |
| 4 | Garde-fous : hors sujet, urgence, avis médical personnel | à faire |
| 5 | Détection de la langue et darija | à faire |
| 6 | Rédaction des réponses par un LLM (optionnelle) | à faire |
| 7 | Branchement sur le backend, Docker | à faire |
