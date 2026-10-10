import json
from pathlib import Path

import pytest

from app.kb import load_kb
from app.normalize import normalize, tokens
from app.search import KbSearch, is_confident

search = KbSearch(load_kb())
GOLDEN = json.loads((Path(__file__).parent / "golden_queries.json").read_text(encoding="utf-8"))["queries"]


class TestNormalize:
    def test_french_accents_case_and_plurals(self):
        assert tokens("Tatouages ÉTÉ") == ["tatouage", "ete"]
        assert normalize("L’hépatite") == "l hepatite"

    def test_stopwords_are_removed_but_question_words_kept(self):
        assert tokens("je peux donner") == ["donner"]
        assert "comment" in tokens("comment ça se passe")

    def test_arabic_variants_are_unified(self):
        assert tokens("أَلَم") == tokens("الم")  # voyelles courtes et hamza
        assert tokens("ڨلت") == tokens("قلت")  # ڨ tunisien

    def test_arabic_definite_article_and_clitics(self):
        assert tokens("الدم") == ["دم"]
        assert tokens("بالدم") == ["دم"]

    def test_digits_and_one_letter_words_are_dropped(self):
        assert tokens("a 12 ٣ و") == []


class TestSearch:
    def test_empty_or_stopword_only_queries_match_nothing(self):
        assert search.search("   ") == []
        assert search.search("je peux le") == []
        assert not is_confident(search.search("je peux le"))

    def test_scores_are_between_0_and_1_and_sorted(self):
        m = search.search("tatouage et piercing", top_k=5)
        scores = [x.score for x in m]
        assert all(0.0 <= s <= 1.0 for s in scores)
        assert scores == sorted(scores, reverse=True)

    def test_typo_is_tolerated(self):
        m = search.search("j'ai fait un tatouege")
        assert m[0].entry.id == "tatouage-piercing"
        assert is_confident(m)

    def test_matched_language_is_reported(self):
        assert search.search("tatouage piercing")[0].language == "fr"
        assert search.search("وشم وثقب")[0].language == "ar"


def _evaluate():
    in_scope = [c for c in GOLDEN if c["expected"]]
    off_topic = [c for c in GOLDEN if not c["expected"]]
    top1 = top3 = rejected = 0
    for c in in_scope:
        m = search.search(c["q"])
        if is_confident(m) and m[0].entry.id == c["expected"]:
            top1 += 1
        if c["expected"] in [x.entry.id for x in m]:
            top3 += 1
    for c in off_topic:
        if not is_confident(search.search(c["q"])):
            rejected += 1
    return top1 / len(in_scope), top3 / len(in_scope), rejected / len(off_topic)


def test_golden_set_quality_does_not_regress():
    """Garde-fou : si on touche à la base ou au moteur, ces trois mesures ne doivent pas baisser."""
    top1, top3, rejected = _evaluate()
    assert top1 >= 0.90, f"bonne entrée en tête et confiante : {top1:.0%}"
    assert top3 >= 0.97, f"bonne entrée dans le top 3 : {top3:.0%}"
    assert rejected >= 0.90, f"questions hors sujet refusées : {rejected:.0%}"
