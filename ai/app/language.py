"""Langue de la réponse : explicite si fournie, sinon détectée à partir du message.

Détection (language="auto") :
  - lettres arabes dominantes : arabe standard (« ar ») si le message contient clairement des mots
    standard (هل، ماذا، يمكنني…), sinon darija. Sans indice, on garde la voix du bot : darija.
  - lettres latines avec chiffres-lettres (3andi, 9alb, wja3) ou mots d'arabizi (kifech, chnowa…) :
    arabizi -> ARABIZI_REPLY_LANGUAGE.
  - tout le reste : français.

Les horaires (« 9h30 »), ordinaux (« 2ème ») et unités (« 5 ml ») ne comptent pas comme arabizi.
"""
import re

from .normalize import normalize

# Réponse donnée à quelqu'un qui écrit en arabizi. « darija » = voix du bot (lettres arabes).
# Mettre « fr » pour répondre en français à ces messages.
ARABIZI_REPLY_LANGUAGE = "darija"

_ARABIC = re.compile(r"[\u0600-\u06FF]")
_LATIN = re.compile(r"[A-Za-z]")
_TOKEN_SPLIT = re.compile(r"[^\w]+")
_DIGIT_LETTER = re.compile(r"[a-z][235789]|[235789][a-z]")  # 3andi, 9alb, 7abba, wja3
_NOT_ARABIZI = re.compile(r"^\d+(h|hr|min|mn|ml|mg|kg|g|km|cm|m|e|eme|er|ere|nd|nde|st|rd|th)\d*$")


def _normalized(words: list[str]) -> set[str]:
    return {normalize(w) for w in words}


# Mots qui trahissent l'arabe standard (le darija dit شنوه، وين، باش…)
_MSA_MARKERS = _normalized([
    "هل", "ماذا", "لماذا", "كيف", "يمكنني", "يمكن", "استطيع", "أريد", "لدي",
    "الذي", "التي", "أين", "متى", "ليس", "سوف",
])

# Mots tunisiens
_DARIJA_MARKERS = _normalized([
    "شنوه", "شنو", "شنوا", "برشا", "بارشا", "توا", "نجم", "تنجم", "تنجمي", "نحب",
    "كيفاش", "علاش", "وين", "وقتاش", "قداش", "باش", "بش", "متاع", "ياسر", "فما",
    "هاذا", "هاذي", "هذي", "اللي", "خاطر",
])

# Mots d'arabizi sans chiffre (avec chiffre, c'est déjà détecté par _DIGIT_LETTER)
_ARABIZI_WORDS = {
    "kifech", "kifeh", "chnowa", "chnoua", "chnouwa", "chnia", "barcha", "barsha", "behi",
    "mouch", "famma", "najem", "nejem", "nheb", "bech", "besh", "yaser", "yesser", "aslema",
    "ahla", "winou",
}


def detect_language(message: str) -> str:
    """fr | ar | darija. Sans indice clair : fr pour le latin, darija pour l'arabe."""
    text = normalize(message)
    arabic, latin = len(_ARABIC.findall(text)), len(_LATIN.findall(text))

    if arabic and arabic >= latin:
        words = set(_TOKEN_SPLIT.split(text))
        return "ar" if len(words & _MSA_MARKERS) > len(words & _DARIJA_MARKERS) else "darija"

    tokens = [t for t in _TOKEN_SPLIT.split(text) if t]
    if any(t in _ARABIZI_WORDS or (_DIGIT_LETTER.search(t) and not _NOT_ARABIZI.match(t)) for t in tokens):
        return ARABIZI_REPLY_LANGUAGE
    return "fr"


def resolve_language(requested: str, message: str) -> str:
    """Langue explicite si fournie, sinon détection."""
    if requested != "auto":
        return requested
    return detect_language(message)
