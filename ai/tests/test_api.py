import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.texts import DISCLAIMERS

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "damm-ai", "version": "0.1.0"}


def test_chat_defaults_to_french():
    r = client.post("/chat", json={"message": "Puis-je donner mon sang ?"})
    assert r.status_code == 200
    body = r.json()
    assert body["language"] == "fr"
    assert body["intent"] == "stub"
    assert body["needs_staff"] is False
    assert body["sources"] == []


@pytest.mark.parametrize("lang", ["fr", "ar", "darija"])
def test_chat_respects_language_and_always_returns_disclaimer(lang):
    r = client.post("/chat", json={"message": "سؤال", "language": lang})
    assert r.status_code == 200
    body = r.json()
    assert body["language"] == lang
    assert body["disclaimer"] == DISCLAIMERS[lang]


def test_arabic_answers_use_arabic_script():
    for lang in ("ar", "darija"):
        body = client.post("/chat", json={"message": "x", "language": lang}).json()
        assert any("\u0600" <= c <= "\u06ff" for c in body["answer"])


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"message": ""},
        {"message": "   "},
        {"message": "a" * 501},
        {"message": "ok", "language": "klingon"},
    ],
)
def test_invalid_requests_are_rejected(payload):
    assert client.post("/chat", json=payload).status_code == 422


def test_message_is_trimmed_and_500_chars_accepted():
    assert client.post("/chat", json={"message": "  salam  "}).status_code == 200
    assert client.post("/chat", json={"message": "a" * 500}).status_code == 200
