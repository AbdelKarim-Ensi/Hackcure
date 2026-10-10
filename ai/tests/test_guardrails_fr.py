import pytest

from app.guardrails import check_guardrails, off_topic_result, normalize


def test_normalize():
    assert normalize("J’ai MAL à la tête !") == "j ai mal a la tete"


@pytest.mark.parametrize("msg", [
    "J'ai une douleur à la poitrine",
    "Mon père a une douleur thoracique depuis ce matin",
    "Je pense que c'est une crise cardiaque",
    "Je n'arrive plus à respirer",
    "Elle est tombée, elle est inconsciente",
    "Il fait des convulsions",
    "Il saigne abondamment",
    "Mon enfant a avalé un produit ménager",
    "J'ai envie de mourir",
    "Je veux me suicider",
    "Urgence !!",
    "AU SECOURS",
])
def test_emergency(msg):
    r = check_guardrails(msg)
    assert r.reason == "emergency"
    assert "190" in r.answer


@pytest.mark.parametrize("msg", [
    "Quel médicament dois-je prendre pour la fièvre ?",
    "Combien de comprimés de paracétamol par jour ?",
    "Puis-je arrêter mon traitement ?",
    "Est-ce que je peux prendre de l'ibuprofène ?",
    "J'ai mal au ventre depuis deux jours",
    "Je pense avoir le diabète",
    "Mon bébé a de la fièvre",
    "Pouvez-vous me donner un diagnostic ?",
    "Quelle est la posologie de l'amoxicilline ?",
])
def test_medical_advice(msg):
    assert check_guardrails(msg).reason == "medical_advice"


@pytest.mark.parametrize("msg", [
    "Comment créer un compte ?",
    "Comment prendre rendez-vous sur la plateforme ?",
    "Quels sont vos horaires ?",
    "Comment modifier mon mot de passe ?",
])
def test_no_guardrail(msg):
    assert not check_guardrails(msg).triggered


def test_emergency_beats_medical_advice():
    # Contains both "que dois-je faire" and a chest-pain emergency
    assert check_guardrails("J'ai une douleur à la poitrine, que dois-je faire ?").reason == "emergency"


def test_off_topic_threshold():
    assert off_topic_result(0.10).reason == "off_topic"
    assert not off_topic_result(0.80).triggered
