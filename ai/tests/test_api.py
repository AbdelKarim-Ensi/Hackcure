import pytest
from fastapi.testclient import TestClient

from app.kb import load_kb
from app.main import app
from app.texts import DISCLAIMERS, FALLBACK_ANSWERS

client = TestClient(app)
KB = {e.id: e for e in load_kb()}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "damm-ai", "version": "0.1.0"}


def test_known_question_returns_the_kb_answer_with_its_source():
    r = client.post("/chat", json={"message": "Qui peut donner son sang ?"})
    body = r.json()
    assert r.status_code == 200
    assert body["intent"] == "faq"
    assert body["language"] == "fr"
    assert body["answer"] == KB["eligibilite-generale"].answer.fr
    assert body["sources"] == [{"id": "eligibilite-generale", "title": KB["eligibilite-generale"].topic}]
    assert body["needs_staff"] is False


@pytest.mark.parametrize(
    "message, lang",
    [("Qui peut donner son sang ?", "fr"), ("من يمكنه التبرع بالدم؟", "ar"), ("شكون ينجم يتبرع بالدم؟", "darija")],
)
def test_explicit_language_controls_the_answer_language(message, lang):
    body = client.post("/chat", json={"message": message, "language": lang}).json()
    assert body["language"] == lang
    assert body["answer"] == getattr(KB["eligibilite-generale"].answer, lang)
    assert body["disclaimer"] == DISCLAIMERS[lang]


def test_arabic_script_defaults_to_darija_and_latin_to_french():
    assert client.post("/chat", json={"message": "شكون ينجم يتبرع بالدم؟"}).json()["language"] == "darija"
    assert client.post("/chat", json={"message": "Qui peut donner son sang ?"}).json()["language"] == "fr"


def test_sensitive_topics_are_escalated_to_staff():
    body = client.post("/chat", json={"message": "j'ai eu une hépatite"}).json()
    assert body["intent"] == "escalate"
    assert body["needs_staff"] is True
    assert body["sources"][0]["id"] == "hepatite-vih"


@pytest.mark.parametrize("message", ["recette du couscous", "quel est le meilleur téléphone", "bonjour"])
def test_unknown_questions_get_an_honest_fallback(message):
    body = client.post("/chat", json={"message": message}).json()
    assert body["intent"] == "out_of_scope"
    assert body["sources"] == []
    assert body["answer"] == FALLBACK_ANSWERS["fr"]


@pytest.mark.parametrize("lang", ["fr", "ar", "darija"])
def test_disclaimer_is_always_present(lang):
    for message in ("Qui peut donner son sang ?", "recette du couscous"):
        body = client.post("/chat", json={"message": message, "language": lang}).json()
        assert body["disclaimer"] == DISCLAIMERS[lang]


@pytest.mark.parametrize(
    "payload",
    [{}, {"message": ""}, {"message": "   "}, {"message": "a" * 501}, {"message": "ok", "language": "klingon"}],
)
def test_invalid_requests_are_rejected(payload):
    assert client.post("/chat", json=payload).status_code == 422


def test_message_is_trimmed_and_500_chars_accepted():
    assert client.post("/chat", json={"message": "  salam  "}).status_code == 200
    assert client.post("/chat", json={"message": "a" * 500}).status_code == 200
