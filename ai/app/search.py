"""Recherche dans la base de connaissances : déterministe, sans modèle ni clé d'API.

Principe : pour chaque entrée et chaque langue, on compare les mots de la question de l'utilisateur
aux mots-clés (poids 3), à la question type (poids 2) et à la réponse (poids 1). Un mot rare dans la base
compte plus qu'un mot courant (IDF). Le score final est dans [0, 1] : la part de la question « expliquée »
par l'entrée.
"""
import math
from dataclasses import dataclass
from difflib import get_close_matches

from .kb import LANGS, KbEntry
from .normalize import WEAK_WORDS, tokens

FIELD_WEIGHTS = {"keywords": 3.0, "question": 2.0, "answer": 1.0}
MAX_WEIGHT = max(FIELD_WEIGHTS.values())
CONFIDENCE_THRESHOLD = 0.35
FUZZY_CUTOFF = 0.84  # tolérance aux fautes de frappe (mots d'au moins 5 lettres)
WEAK_FACTOR = 0.3  # mots interrogatifs (comment, pourquoi, كيفاش...) : ils ne désignent pas un sujet
UNKNOWN_WEIGHT = 0.5  # un mot inconnu pèse moitié moins : il peut n'être qu'un mot de remplissage


@dataclass(frozen=True)
class Match:
    entry: KbEntry
    score: float
    language: str  # langue de l'entrée qui a le mieux correspondu


class KbSearch:
    def __init__(self, entries: list[KbEntry]):
        self.entries = entries
        # index[lang][entry_id] = {jeton: poids du meilleur champ}
        self.index: dict[str, dict[str, dict[str, float]]] = {lang: {} for lang in LANGS}
        self.idf: dict[str, dict[str, float]] = {}
        self.vocab: dict[str, list[str]] = {}
        for lang in LANGS:
            df: dict[str, int] = {}
            for e in entries:
                weights: dict[str, float] = {}
                fields = {
                    "keywords": " ".join(getattr(e.keywords, lang)),
                    "question": getattr(e.question, lang),
                    "answer": getattr(e.answer, lang),
                }
                for field, text in fields.items():
                    for tok in tokens(text):
                        weights[tok] = max(weights.get(tok, 0.0), FIELD_WEIGHTS[field])
                self.index[lang][e.id] = weights
                for tok in weights:
                    df[tok] = df.get(tok, 0) + 1
            n = len(entries)
            self.idf[lang] = {tok: math.log(1 + n / (1 + d)) for tok, d in df.items()}
            self.vocab[lang] = sorted(df)

    def _resolve(self, token: str, lang: str) -> str | None:
        """Le jeton lui-même s'il est connu, sinon son plus proche voisin (fautes de frappe)."""
        if token in self.idf[lang]:
            return token
        if len(token) >= 5:
            close = get_close_matches(token, self.vocab[lang], n=1, cutoff=FUZZY_CUTOFF)
            if close:
                return close[0]
        return None

    def _score(self, query: list[str], entry: KbEntry, lang: str) -> float:
        n = len(self.entries)
        unknown_idf = UNKNOWN_WEIGHT * math.log(1 + n)  # un mot jamais vu fait baisser le score, sans l'écraser
        total = 0.0
        matched = 0.0
        for tok in query:
            resolved = self._resolve(tok, lang)
            if resolved is None:
                total += unknown_idf * (WEAK_FACTOR if tok in WEAK_WORDS else 1.0)
                continue
            idf = self.idf[lang][resolved] * (WEAK_FACTOR if resolved in WEAK_WORDS else 1.0)
            total += idf
            matched += idf * self.index[lang][entry.id].get(resolved, 0.0) / MAX_WEIGHT
        return matched / total if total else 0.0

    def search(self, query: str, top_k: int = 3) -> list[Match]:
        q = tokens(query)
        if not q:
            return []
        matches = []
        for e in self.entries:
            best_lang, best = max(((lang, self._score(q, e, lang)) for lang in LANGS), key=lambda x: x[1])
            matches.append(Match(entry=e, score=round(best, 4), language=best_lang))
        matches.sort(key=lambda m: (-m.score, m.entry.id))
        return matches[:top_k]


def is_confident(matches: list[Match]) -> bool:
    return bool(matches) and matches[0].score >= CONFIDENCE_THRESHOLD
