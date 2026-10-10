"""Le LLM ne doit jamais toucher aux urgences, aux refus ni au hors-sujet."""
import pytest
from fastapi.testclient import TestClient

import app.main as main_module

client = TestClient(main_module.app)


def post(message: str, language: str = "fr") -> dict:
    r = client.post("/chat", json={"message": message, "language": language})
    assert r.status_code == 200
    return r.json()


def _forbidden(*args, **kwargs):
    raise AssertionError("reword() ne doit pas être appelé ici")


@pytest.mark.parametrize("message, language, intent", [
    ("J'ai une douleur à la poitrine", "fr", "emergency"),
    ("لا أستطيع التنفس", "ar", "emergency"),
    ("3andi wja3 fil sder", "fr", "emergency"),
    ("Quelle dose de paracétamol dois-je prendre ?", "fr", "escalate"),
    ("Quelle est la capitale du Japon ?", "fr", "out_of_scope"),
])
def test_llm_never_called_for_guardrails_or_fallback(monkeypatch, message, language, intent):
    monkeypatch.setattr(main_module, "reword", _forbidden)
    assert post(message, language)["intent"] == intent


def test_llm_failure_keeps_validated_answer(monkeypatch):
    monkeypatch.setattr(main_module, "reword", lambda q, a, lang: None)
    body = post("Qui peut donner son sang ?")
    assert body["answer"]  # réponse validée de la KB, jamais vide


@pytest.mark.parametrize("message", ["Qui peut donner son sang ?", "Puis-je donner si j'ai un tatouage ?"])
def test_reworded_text_used_only_for_validated_non_staff_faq(monkeypatch, message):
    monkeypatch.setattr(main_module, "reword", lambda q, a, lang: "TEXTE REFORMULE")
    body = post(message)
    entry = main_module._search.search(message)[0].entry
    if body["intent"] == "faq" and entry.validated:
        assert body["answer"] == "TEXTE REFORMULE"
    else:  # escalade au personnel ou entrée non validée : texte de la KB inchangé
        assert body["answer"] != "TEXTE REFORMULE"
