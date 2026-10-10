"""Guardrails (French first). Runs BEFORE knowledge-base search and any LLM.

Usage in /chat:
    result = check_guardrails(message)
    if result.triggered:
        return {"answer": result.answer, "guardrail": result.reason, ...}
    # else continue with KB search
"""
import re
import unicodedata
from dataclasses import dataclass
from typing import Optional

# --- Fixed answers (to be reviewed by a medical validator) -------------------

EMERGENCY_FR = (
    "Cette situation peut être une urgence. N'attendez pas : appelez le SAMU au 190 "
    "ou rendez-vous immédiatement aux urgences les plus proches. "
    "Si une autre personne est avec vous, demandez-lui de rester à vos côtés."
)

MEDICAL_ADVICE_FR = (
    "Je ne peux pas donner de conseil médical personnalisé, ni de diagnostic ou de dosage. "
    "Pour votre situation, parlez à un médecin ou à un pharmacien. "
    "Je peux en revanche vous donner des informations générales validées sur la plateforme."
)

OFF_TOPIC_FR = (
    "Je ne peux répondre qu'aux questions liées à cette plateforme. "
    "Pouvez-vous reformuler votre question ?"
)

# --- Normalisation ------------------------------------------------------------


def normalize(text: str) -> str:
    """Lowercase, strip accents, turn apostrophes/punctuation into spaces."""
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[’'`´]", " ", text)
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# --- Patterns (applied on normalised text, so no accents) ---------------------

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

_EMERGENCY_RE = [re.compile(p) for p in EMERGENCY_PATTERNS_FR]
_MEDICAL_RE = [re.compile(p) for p in MEDICAL_ADVICE_PATTERNS_FR]

# --- Result type ---------------------------------------------------------------


@dataclass(frozen=True)
class GuardrailResult:
    reason: Optional[str] = None  # "emergency" | "medical_advice" | "off_topic" | None
    answer: Optional[str] = None
    matched: Optional[str] = None  # pattern that fired (useful for logs/debug)

    @property
    def triggered(self) -> bool:
        return self.reason is not None


def check_emergency(message: str) -> GuardrailResult:
    """Run FIRST in /chat, before KB search."""
    text = normalize(message)
    for rx in _EMERGENCY_RE:
        if rx.search(text):
            return GuardrailResult("emergency", EMERGENCY_FR, rx.pattern)
    return GuardrailResult()


def check_medical_advice(message: str) -> GuardrailResult:
    """Run only when the KB has no confident answer (donor eligibility questions
    like 'puis-je donner si j'ai de la fièvre ?' must reach the KB first)."""
    text = normalize(message)
    for rx in _MEDICAL_RE:
        if rx.search(text):
            return GuardrailResult("medical_advice", MEDICAL_ADVICE_FR, rx.pattern)
    return GuardrailResult()


def check_guardrails(message: str) -> GuardrailResult:
    """Both checks in order (emergency wins). Handy for tests and quick use."""
    return check_emergency(message) if check_emergency(message).triggered else check_medical_advice(message)


def off_topic_result(best_score: float, threshold: float = 0.35) -> GuardrailResult:
    """Call after KB search. Adjust threshold using your real search scores."""
    if best_score < threshold:
        return GuardrailResult("off_topic", OFF_TOPIC_FR, f"score<{threshold}")
    return GuardrailResult()
