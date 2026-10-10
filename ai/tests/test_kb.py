import re

import pytest
from pydantic import ValidationError

from app.kb import KbEntry, LANGS, load_kb

ARABIC = re.compile(r"[\u0600-\u06FF]")
DIGIT = re.compile(r"[0-9\u0660-\u0669]")
kb = load_kb()


def test_kb_loads_with_enough_entries():
    assert len(kb) >= 15


def test_ids_are_unique():
    ids = [e.id for e in kb]
    assert len(set(ids)) == len(ids)


@pytest.mark.parametrize("entry", kb, ids=lambda e: e.id)
def test_every_entry_is_complete_in_three_languages(entry):
    for lang in LANGS:
        assert getattr(entry.question, lang).strip()
        assert len(getattr(entry.answer, lang).strip()) > 20
        assert len(getattr(entry.keywords, lang)) >= 2


@pytest.mark.parametrize("entry", kb, ids=lambda e: e.id)
def test_scripts_match_languages(entry):
    assert not ARABIC.search(entry.question.fr + entry.answer.fr)
    for lang in ("ar", "darija"):
        assert ARABIC.search(getattr(entry.question, lang))
        assert ARABIC.search(getattr(entry.answer, lang))


@pytest.mark.parametrize("entry", kb, ids=lambda e: e.id)
def test_answers_are_short_enough_for_a_chat(entry):
    for lang in LANGS:
        assert len(getattr(entry.answer, lang)) <= 600


@pytest.mark.parametrize("entry", kb, ids=lambda e: e.id)
def test_unvalidated_entries_contain_no_numbers(entry):
    """Règle d'or : tant qu'une entrée n'est pas validée, aucune durée, âge ou poids dans le texte."""
    if not entry.validated:
        for lang in LANGS:
            assert not DIGIT.search(getattr(entry.answer, lang)), f"{entry.id}/{lang}"


def test_validated_entry_requires_a_source():
    base = dict(
        id="x", topic="t", validated=True,
        question=dict(fr="q", ar="س", darija="س"),
        answer=dict(fr="a", ar="ج", darija="ج"),
        keywords=dict(fr=["a"], ar=["ب"], darija=["ب"]),
    )
    with pytest.raises(ValidationError):
        KbEntry(**base)
    assert KbEntry(**base, source="Circulaire CNTS (exemple)").validated is True


def test_sensitive_topics_are_escalated_to_staff():
    flagged = {e.id for e in kb if e.needs_staff}
    assert {"maladie-chronique-traitement", "hepatite-vih"} <= flagged
