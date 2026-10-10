"""Guardrails (français + arabe). Exécutés AVANT la recherche et tout LLM.

Ordre dans /chat :
    1. check_emergency        -> toujours en premier
    2. recherche dans la KB   -> si confiante, on répond depuis la KB
    3. check_medical_advice   -> seulement si la KB n'a rien de sûr
    4. repli « hors sujet »

Les motifs des deux langues sont testés quelle que soit la langue demandée
(un message arabe peut arriver avec language="fr"). La langue de la réponse
est celle demandée / détectée ; le darija utilise pour l'instant le texte arabe.
"""
import re
import unicodedata
from dataclasses import dataclass
from typing import Optional

# --- Réponses fixes (à faire relire par un validateur médical) ----------------

EMERGENCY = {
    "fr": (
        "Cette situation peut être une urgence. N'attendez pas : appelez le SAMU au 190 "
        "ou rendez-vous immédiatement aux urgences les plus proches. "
        "Si une autre personne est avec vous, demandez-lui de rester à vos côtés."
    ),
    "ar": (
        "قد تكون هذه حالة طارئة. لا تنتظر: اتصل بالإسعاف (SAMU) على الرقم 190 "
        "أو توجّه فورًا إلى أقرب قسم للطوارئ. "
        "وإذا كان معك شخص آخر، اطلب منه البقاء بجانبك."
    ),
}

MEDICAL_ADVICE = {
    "fr": (
        "Je ne peux pas donner de conseil médical personnalisé, ni de diagnostic ou de dosage. "
        "Pour votre situation, parlez à un médecin ou à un pharmacien. "
        "Je peux en revanche vous donner des informations générales validées sur la plateforme."
    ),
    "ar": (
        "لا يمكنني تقديم نصيحة طبية شخصية، ولا تشخيص الحالات أو تحديد الجرعات. "
        "بخصوص حالتك، تحدّث إلى طبيب أو صيدلي. "
        "يمكنني فقط تقديم معلومات عامة موثّقة على المنصة."
    ),
}

OFF_TOPIC = {
    "fr": (
        "Je ne peux répondre qu'aux questions liées à cette plateforme. "
        "Pouvez-vous reformuler votre question ?"
    ),
    "ar": "يمكنني فقط الإجابة عن الأسئلة المتعلقة بهذه المنصة. هل يمكنك إعادة صياغة سؤالك؟",
}

# darija = texte arabe pour l'instant (étape darija plus tard)
_ANSWER_LANG = {"fr": "fr", "ar": "ar", "darija": "ar"}


def _pick(texts: dict, language: str) -> str:
    return texts[_ANSWER_LANG.get(language, "fr")]


# --- Normalisation ------------------------------------------------------------

# NFD + suppression des marques combinantes retire déjà les voyelles courtes et
# unifie les hamzas (أ إ آ -> ا ; ؤ -> و ; ئ -> ي). Reste : ى, ة, tatweel, chiffres.
_AR_MAP = str.maketrans({"ى": "ي", "ة": "ه", "ـ": None, "ڨ": "ق", "ڤ": "ف"})


def normalize(text: str) -> str:
    """Minuscules, accents et voyelles arabes retirés, lettres arabes unifiées, ponctuation neutralisée."""
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.translate(_AR_MAP)
    text = re.sub(r"[’'`´]", " ", text)
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# --- Motifs (appliqués sur le texte NORMALISÉ) --------------------------------

EMERGENCY_PATTERNS_FR = [
    r"douleur\w* (a|dans) (la |le |ma |mon )?(poitrine|thorax|coeur)",
    r"douleur\w* thoracique",
    r"crise cardiaque|infarctus|\bavc\b|accident vasculaire",
    r"(ne|n) (arrive|arrivent) (plus |pas )?a respirer|difficultes? a respirer|\betouff",
    r"(ne|n) respire (plus|pas)",
    r"perte de connaissance|perdu connaissance|evanoui|inconscient|(ne|n) reagit (plus|pas)",
    r"convulsion|crise d epilepsie",
    r"saigne (beaucoup|abondamment)|hemorragie|saignement (abondant|important|qui (ne )?s arrete pas)",
    r"overdose|surdose|empoisonn|intoxication",
    r"(avale|ingere|bu) .{0,30}(produit|poison|medicaments?|pilules?)",
    r"reaction allergique (grave|severe)|choc anaphylactique|gonfle.{0,20}(gorge|visage|langue)",
    r"brulure grave|accident grave|accident de la route",
    r"me suicider|suicide|envie de mourir|veux mourir|en finir avec la vie|mettre fin a mes jours",
    r"me faire du mal|me tuer",
    r"\burgence\b|\bau secours\b|appelez? (une |le )?(ambulance|samu)",
]

MEDICAL_ADVICE_PATTERNS_FR = [
    r"quel(le)?s? (medicaments?|traitements?|antibiotiques?|pilules?|doses?|dosages?)",
    r"(quelle|combien) (dose|de doses?|de comprimes?|de gouttes?|de gelules?|de mg)",
    r"(dois|puis|peux|devrais) (je|j) (prendre|arreter|augmenter|diminuer|melanger)",
    r"(est ce que|est ce) (je|j) (peux|dois|devrais) (prendre|arreter)",
    r"que (dois|puis|peux) (je|j) (faire|prendre)",
    r"(c est|est ce) (grave|dangereux)",
    r"(quelle|quel) (est )?(mon|ma) (maladie|diagnostic|probleme)",
    r"diagnostic|diagnostiquer",
    r"(j ai|ai je|ca ressemble a|je pense avoir|je crois avoir) .{0,40}(cancer|diabete|covid|hepatite|sida|tumeur|depression)",
    r"(j ai|je ressens|je souffre) .{0,40}(mal|douleur|fievre|vertige|nausee|toux|eruption|boutons?)",
    r"(mon|ma|mes) (enfant|bebe|fils|fille|pere|mere|mari|femme).{0,40}(fievre|mal|douleur|vomi|toux)",
    r"ordonnance|prescri(re|ption)|posologie",
    r"enceinte.{0,40}(puis je|dois je|prendre)",
]

# Rappel : ici tout est déjà normalisé -> pas de hamza (ا), ة devient ه, ى devient ي,
# ئ devient ي (« طوارئ » -> « طواري », « طارئة » -> « طاريه »).
EMERGENCY_PATTERNS_AR = [
    r"(الم|وجع)\s+(\w+\s+)?(في\s+|ب)?(ال)?(صدر|قلب)",
    r"نوبه\s+قلبيه|جلطه|سكته\s+(قلبيه|دماغيه)",
    r"لا\s+(استطيع|اقدر|اتمكن)\s+(علي\s+)?(ان\s+)?(ال)?(تنفس|اتنفس)",
    r"لا\s+(ي|ت)تنفس|توقف\w*\s+(عن\s+)?(ال)?تنفس",
    r"صعوبه\s+(في\s+)?(ال)?تنفس|ضيق\s+(في\s+)?(ال)?(تنفس|نفس)|اختناق|اختنق",
    r"فقد\w*\s+(لل|ال)?وعي|فاقد\w*\s+(لل|ال)?وعي|اغمي|اغماء|مغمي",
    r"تشنج|نوبه\s+صرع|صرع",
    r"نزيف\s+(حاد|شديد|غزير|كبير)|ينزف|تنزف|نزيف\s+لا\s+يتوقف",
    r"تسمم|جرعه\s+زايده|ابتلع\w*\s+.{0,30}(سم|مواد|منظف|دواء|ادويه|حبوب)",
    r"حساسيه\s+(شديده|خطيره|حاده)|صدمه\s+(تحسسيه|تاقيه)",
    r"انتحار|انتحر|اريد\s+(ان\s+)?اموت|اريد\s+الموت|لا\s+اريد\s+(ان\s+)?اعيش",
    r"اقتل\s+نفسي|انهي\s+حياتي|انهاء\s+حياتي|ا(و)?ذي\s+نفسي",
    r"حاله\s+طاريه|طواري|اسعاف|نجده|انقذوني|ساعدوني",
]

MEDICAL_ADVICE_PATTERNS_AR = [
    r"(اي|ما|ماهو|ماهي|ما\s+هو|ما\s+هي)\s+(ال)?(دواء|ادويه|علاج|جرعه|مضاد)",
    r"كم\s+(جرعه|حبه|حبات|قرص|اقراص|مغ|ملغ|قطره|قطرات|كبسوله)",
    r"هل\s+(يمكنني|استطيع|يجب\s+علي|ينبغي\s+لي|يجوز\s+لي)\s+(ان\s+)?(اتناول|اخذ|اوقف|ايقاف|اتوقف|اخلط|ازيد|اقلل)",
    r"هل\s+(هذا\s+|هو\s+|هي\s+|الامر\s+)?(خطير|خطيره)",
    r"تشخيص|شخص\w*\s+حالت",
    r"(اعاني\s+من|اشعر|لدي|عندي|اشكو\s+من)\s+.{0,40}(الم|وجع|حمي|حراره|دوار|دوخه|غثيان|سعال|طفح|صداع|اسهال)",
    r"(لدي|عندي|مصاب|اصبت|اعتقد|اظن).{0,40}(سرطان|سكري|كورونا|كوفيد|التهاب\s+الكبد|ايدز|ورم|اكتئاب)",
    r"وصفه\s+(طبيه|الطبيب|دواء)|جرعه|جرعات",
    r"(طفلي|ابني|ابنتي|رضيعي|ابي|امي|زوجي|زوجتي).{0,40}(حمي|حراره|الم|وجع|قيء|سعال|اسهال)",
    r"حامل.{0,40}(هل\s+يمكنني|هل\s+استطيع|اتناول|اخذ)",
]

_EMERGENCY_RE = [re.compile(p) for p in EMERGENCY_PATTERNS_FR + EMERGENCY_PATTERNS_AR]
_MEDICAL_RE = [re.compile(p) for p in MEDICAL_ADVICE_PATTERNS_FR + MEDICAL_ADVICE_PATTERNS_AR]

# --- Résultat -------------------------------------------------------------------


@dataclass(frozen=True)
class GuardrailResult:
    reason: Optional[str] = None  # "emergency" | "medical_advice" | "off_topic" | None
    answer: Optional[str] = None
    matched: Optional[str] = None  # motif déclencheur (logs / debug)

    @property
    def triggered(self) -> bool:
        return self.reason is not None


def check_emergency(message: str, language: str = "fr") -> GuardrailResult:
    """À exécuter EN PREMIER dans /chat, avant la recherche."""
    text = normalize(message)
    for rx in _EMERGENCY_RE:
        if rx.search(text):
            return GuardrailResult("emergency", _pick(EMERGENCY, language), rx.pattern)
    return GuardrailResult()


def check_medical_advice(message: str, language: str = "fr") -> GuardrailResult:
    """À exécuter seulement si la KB n'a pas de réponse sûre (les questions d'éligibilité
    du donneur, ex. « puis-je donner si j'ai de la fièvre ? », doivent d'abord atteindre la KB)."""
    text = normalize(message)
    for rx in _MEDICAL_RE:
        if rx.search(text):
            return GuardrailResult("medical_advice", _pick(MEDICAL_ADVICE, language), rx.pattern)
    return GuardrailResult()


def check_guardrails(message: str, language: str = "fr") -> GuardrailResult:
    """Les deux contrôles dans l'ordre (l'urgence gagne). Pratique pour les tests."""
    emergency = check_emergency(message, language)
    return emergency if emergency.triggered else check_medical_advice(message, language)


def off_topic_result(best_score: float, threshold: float = 0.35, language: str = "fr") -> GuardrailResult:
    """Gardé pour compatibilité : /chat utilise déjà is_confident() pour le hors-sujet."""
    if best_score < threshold:
        return GuardrailResult("off_topic", _pick(OFF_TOPIC, language), f"score<{threshold}")
    return GuardrailResult()
