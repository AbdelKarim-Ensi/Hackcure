import pytest

from app.guardrails import check_emergency, check_guardrails, check_medical_advice, skeleton


def test_skeleton_unifies_arabizi_spellings():
    assert skeleton("3andi wja3 fil sder") == "3nd wj3 fl sdr"
    assert skeleton("3andi wje3 fi sdri") == "3nd wj3 f sdr"
    assert skeleton("nmout") == skeleton("namout") == skeleton("nmot") == "nmt"


# ---------- darija en lettres arabes ----------

@pytest.mark.parametrize("msg", [
    "عندي وجيعة في صدري",
    "صدري يوجعني برشا",
    "قلبي يوجعني",
    "ما نجمش نتنفس",
    "مانيش قادر نتنفس",
    "نتخنق",
    "ضيق نفس",
    "غمي عليه",
    "خويا طاح وما يتحركش",
    "ما يجاوبش",
    "الدم يسيل ما يوقفش",
    "ولدي بلع منظف",
    "شربت سم",
    "باش نموت",
    "نحب نموت",
    "نحب نقتل روحي",
    "ما نحبش نعيش",
    "تعبت من الحياة",
    "عاونوني",
    "اتصلوا بالسامو",
])
def test_emergency_darija_script(msg):
    r = check_emergency(msg, "darija")
    assert r.reason == "emergency", msg
    assert "190" in r.answer
    assert "استعجالية" in r.answer  # réponse en darija


@pytest.mark.parametrize("msg", [
    "شنوه الدوا متاع السخانة؟",
    "شنوه نشرب للراس؟",
    "قداش من حبة نشرب في النهار؟",
    "نجم نشرب باراسيتامول؟",
    "نجم نوقف الدوا؟",
    "عندي سخانة من يومين",
    "عندي صداع",
    "راسي يوجعني",
    "كرشي توجعني",
    "ولدي عندو سخانة",
    "شنوه عندي؟",
    "عندي السكر",
    "هاذا خطير؟",
])
def test_medical_advice_darija_script(msg):
    r = check_medical_advice(msg, "darija")
    assert r.reason == "medical_advice", msg
    assert "طبيب" in r.answer


@pytest.mark.parametrize("msg", [
    "كيفاش نعمل حساب؟",
    "كيفاش نحجز موعد للتبرع؟",
    "وين أقرب مركز للتبرع بالدم؟",
    "نجم نتبرع كان عندي وشم؟",
    "قداش مرة في العام نجم نتبرع؟",
    "شنوه ندير باش نتبرع؟",
    "نموت على القهوة",
    "نموت بالضحك",
    "نجم نشرب قهوة بعد التبرع؟",
    "شنوه الشروط باش نتبرع؟",
])
def test_no_guardrail_darija_script(msg):
    assert not check_guardrails(msg, "darija").triggered, msg


# ---------- arabizi (lettres latines) ----------

@pytest.mark.parametrize("msg", [
    "3andi wja3 fil sder",
    "3andi wje3 fi sdri",
    "3andi wjaa3 fi 9alby",
    "ma nnajemch netnafes",
    "manich 9ader netnafes",
    "ma 9adech ntnafes",
    "wallah net5ane9",
    "nheb nmout",
    "nheb n9tel rou7i",
    "ma nhebch n3ich",
    "manich nheb n3ich",
    "ghma 3lih",
    "ma yet7arekch",
    "ma yjawebch",
])
def test_emergency_arabizi(msg):
    r = check_emergency(msg, "fr")
    assert r.reason == "emergency", msg
    assert "190" in r.answer


@pytest.mark.parametrize("msg", [
    "3andi skhana",
    "3andi sokhna men yomein",
    "3andi sou5ana",
    "3andi wja3 fil ras",
    "chnowa nakhou lel skhana",
    "najem nechreb doliprane",
    "najem nakhdh ibuprofene",
    "9addech men 7abba nakhdh",
    "bnti 3andha skhana",
    "waldi 3andou sou5ana",
    "3andi cancer",
    "3andi sukkar",
    "chnowa 3andi",
])
def test_medical_advice_arabizi(msg):
    r = check_medical_advice(msg, "fr")
    assert r.reason == "medical_advice", msg


@pytest.mark.parametrize("msg", [
    "kifech nforem compte",
    "ma nhebch na3mel tabarro3",
    "najem netbarra3 ba3d ma na3mel tatouage",
    "wa9tech najem netbarra3 men jdid",
    "win a9reb markaz lel tabarro3 bel dem",
    "najem nechreb kahwa ba3d el tabarro3",
    "chnowa chorout el tabarro3",
    "9addech marra fil 3am najem netbarra3",
    "manich mawjoud lyoum",
])
def test_no_guardrail_arabizi(msg):
    assert not check_guardrails(msg, "fr").triggered, msg


# ---------- les autres langues ne sont pas touchées par les motifs darija ----------

@pytest.mark.parametrize("msg", [
    "Comment prendre rendez-vous ?",
    "Puis-je donner si j'ai un tatouage ?",
    "Quel est le numéro de la plateforme ?",
    "Je ne peux pas venir mercredi, comment annuler ?",
    "Comment modifier mon mot de passe ?",
    "كيف أحجز موعدا للتبرع؟",
])
def test_other_languages_not_blocked(msg):
    assert not check_guardrails(msg, "fr").triggered, msg


def test_darija_answer_is_darija_not_msa():
    assert check_emergency("نحب نموت", "darija").answer != check_emergency("أريد أن أموت", "ar").answer


def test_emergency_beats_medical_advice_darija():
    assert check_guardrails("عندي وجيعة في صدري، شنوه الدوا؟", "darija").reason == "emergency"
