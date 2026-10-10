import pytest

from app.language import detect_language, resolve_language


@pytest.mark.parametrize("msg", [
    "Puis-je donner si j'ai un tatouage ?",
    "Comment prendre rendez-vous ?",
    "Bonjour",
    "J'ai rendez-vous à 9h30",
    "Je veux donner à 8h",
    "C'est mon 2ème don",
    "Combien de ml de sang prélève-t-on ?",
    "Je prends de la vitamine B12",
    "Après le COVID-19, puis-je donner ?",
    "Puis-je donner le دم ?",  # quelques lettres arabes dans une phrase française
])
def test_french(msg):
    assert detect_language(msg) == "fr", msg


@pytest.mark.parametrize("msg", [
    "هل يمكنني التبرع بالدم إذا كان لدي وشم؟",
    "ماذا أفعل بعد التبرع؟",
    "كيف أحجز موعدا للتبرع؟",
    "أين أقرب مركز للتبرع؟",
    "هل يمكنني التبرع، شنوه الشروط؟",  # plus de marqueurs standard que de darija
])
def test_modern_standard_arabic(msg):
    assert detect_language(msg) == "ar", msg


@pytest.mark.parametrize("msg", [
    "شنوه الشروط باش نتبرع؟",
    "نجم نتبرع كان عندي وشم؟",
    "قداش مرة في العام نجم نتبرع؟",
    "وين أقرب مركز؟",
    "التبرع بالدم",  # aucun indice : on garde la voix du bot
    "كيفاش نحجز موعد؟",
])
def test_darija_arabic_script(msg):
    assert detect_language(msg) == "darija", msg


@pytest.mark.parametrize("msg", [
    "3andi wja3 fil sder",
    "kifech nforem compte",
    "najem netbarra3 ba3d el tatouage",
    "chnowa chorout el tabarro3",
    "9addech marra fil 3am najem netbarra3",
    "wallah net5ane9",
])
def test_arabizi_uses_configured_reply_language(msg, monkeypatch):
    import app.language as lang
    assert detect_language(msg) == lang.ARABIZI_REPLY_LANGUAGE == "darija", msg


def test_arabizi_reply_language_can_be_switched_to_french(monkeypatch):
    import app.language as lang
    monkeypatch.setattr(lang, "ARABIZI_REPLY_LANGUAGE", "fr")
    assert lang.detect_language("3andi wja3 fil sder") == "fr"


def test_explicit_language_always_wins():
    assert resolve_language("ar", "3andi wja3 fil sder") == "ar"
    assert resolve_language("fr", "شنوه الشروط؟") == "fr"
    assert resolve_language("darija", "Bonjour") == "darija"


def test_auto_uses_detection():
    assert resolve_language("auto", "Bonjour") == "fr"
    assert resolve_language("auto", "ماذا أفعل؟") == "ar"
    assert resolve_language("auto", "chnowa el 3amal") == "darija"
