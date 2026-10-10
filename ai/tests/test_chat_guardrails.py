from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def chat(message: str) -> dict:
    r = client.post("/chat", json={"message": message, "language": "fr"})
    assert r.status_code == 200
    return r.json()


def test_emergency_returns_emergency_intent():
    body = chat("J'ai une douleur à la poitrine")
    assert body["intent"] == "emergency"
    assert body["needs_staff"] is True
    assert "190" in body["answer"]
    assert body["sources"] == []


def test_emergency_beats_kb():
    # Even if the KB could match "donner", an emergency must win
    body = chat("Je n'arrive plus à respirer après avoir donné mon sang")
    assert body["intent"] == "emergency"


def test_donor_eligibility_question_still_reaches_kb():
    # Core donor FAQ: must NOT be blocked by the medical-advice guardrail
    body = chat("Puis-je donner si j'ai un tatouage ?")
    assert body["intent"] in {"faq", "escalate"}
    assert body["sources"], "expected a KB source"


def test_personal_medical_advice_without_kb_match_is_escalated():
    body = chat("Quelle dose de paracétamol dois-je prendre ?")
    assert body["intent"] == "escalate"
    assert body["needs_staff"] is True
    assert "médecin" in body["answer"]


def test_unrelated_question_stays_out_of_scope():
    assert chat("Quelle est la capitale du Japon ?")["intent"] == "out_of_scope"
