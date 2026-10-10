import pytest

from app.guardrails import check_emergency, check_guardrails, check_medical_advice, normalize


def test_normalize_arabic():
    # hamza, voyelles courtes, ة, ى et tatweel sont unifiés
    assert normalize("أَلَمٌ في الصَّدر؟") == "الم في الصدر"
    assert normalize("حالة طارئة") == "حاله طاريه"
    assert normalize("مستشفى") == "مستشفي"


@pytest.mark.parametrize("msg", [
    "أشعر بألم في الصدر",
    "عندي ألم شديد في الصدر",
    "أبي يعاني من نوبة قلبية",
    "لا أستطيع التنفس",
    "لا أقدر على التنفس بعد التبرع",
    "عندي صعوبة في التنفس",
    "هو فاقد للوعي",
    "فقدت الوعي",
    "أغمي عليها",
    "ابني يعاني من تشنجات",
    "ينزف بشدة",
    "نزيف حاد",
    "ابتلع طفلي مادة منظفة",
    "تسمم",
    "جرعة زائدة",
    "أريد أن أموت",
    "أفكر في الانتحار",
    "أريد أن أقتل نفسي",
    "هذه حالة طارئة",
    "نجدة!",
    "أحتاج إسعاف",
])
def test_emergency_ar(msg):
    r = check_emergency(msg, "ar")
    assert r.reason == "emergency", msg
    assert "190" in r.answer
    assert "طارئة" in r.answer  # réponse en arabe


@pytest.mark.parametrize("msg", [
    "ما هو الدواء المناسب للحمى؟",
    "أي دواء أتناول للصداع؟",
    "كم قرص باراسيتامول يجب أن أتناول يوميا؟",
    "هل يمكنني أن أتناول الإيبوبروفين؟",
    "هل يمكنني إيقاف العلاج؟",
    "أعاني من ألم في البطن منذ يومين",
    "أشعر بدوار وغثيان",
    "أظن أن لدي سكري",
    "هل هذا خطير؟",
    "هل يمكنك تشخيص حالتي؟",
    "طفلي عنده حمى",
    "ما هي الجرعة المناسبة؟",
])
def test_medical_advice_ar(msg):
    r = check_medical_advice(msg, "ar")
    assert r.reason == "medical_advice", msg
    assert "طبيب" in r.answer


@pytest.mark.parametrize("msg", [
    "كيف أنشئ حسابا؟",
    "كيف أحجز موعدا للتبرع؟",
    "ما هي ساعات العمل؟",
    "هل يمكنني التبرع إذا كان لدي وشم؟",
    "كم مرة في السنة يمكنني التبرع بالدم؟",
    "أين أقرب مركز للتبرع؟",
])
def test_no_guardrail_ar(msg):
    assert not check_guardrails(msg, "ar").triggered, msg


def test_darija_uses_arabic_text_for_now():
    assert "طارئة" in check_emergency("نجدة", "darija").answer


def test_arabic_message_with_french_language_still_caught():
    r = check_emergency("لا أستطيع التنفس", "fr")
    assert r.reason == "emergency"
    assert "SAMU au 190" in r.answer  # réponse dans la langue demandée


def test_emergency_beats_medical_advice_ar():
    assert check_guardrails("أشعر بألم في الصدر، ماذا أفعل؟", "ar").reason == "emergency"
