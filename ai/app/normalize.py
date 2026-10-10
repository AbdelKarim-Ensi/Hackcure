"""Normalisation et découpage du texte (français, arabe, darija).

Objectif : que « Tatouages ? », « tatouage » et « TATOUAGE » donnent la même clé, et que les variantes
d'écriture arabes (hamza, voyelles courtes, ڨ tunisien...) se rejoignent.
"""
import re
import unicodedata

_ARABIC_DIACRITICS = re.compile("[\u064b-\u065f\u0670\u0640]")  # voyelles courtes, shadda, tatweel
_ARABIC_MAP = str.maketrans(
    {
        "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
        "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه",
        "ڨ": "ق", "ڤ": "ف", "پ": "ب", "گ": "ق",  # lettres utilisées pour écrire le darija
        "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    }
)
_SPLIT = re.compile(r"[^\w]+", re.UNICODE)

# Mots vides : on garde « comment », « pourquoi », « quand » car ils distinguent des questions.
STOPWORDS = {
    "fr": {
        "le", "la", "les", "l", "de", "des", "du", "d", "un", "une", "et", "ou", "a", "au", "aux", "en", "dans",
        "que", "qui", "quoi", "est", "sont", "suis", "je", "j", "ai", "as", "avez", "vous", "tu", "il", "elle",
        "on", "nous", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "ce", "cet", "cette", "ces",
        "pour", "par", "avec", "sans", "sur", "sous", "si", "se", "s", "n", "ne", "pas", "y", "puis", "peux",
        "peut", "pouvez", "m", "t", "qu", "c", "ca", "est-ce", "il", "faut", "fait", "faire", "plus", "tres",
    },
    "ar": {
        "في", "من", "على", "هل", "ما", "ماذا", "عن", "الي", "ان", "اذا", "كان", "كنت", "لي", "لدي", "انا",
        "هذا", "هذه", "او", "و", "ثم", "مع", "قد", "يمكنني", "يمكن", "كل", "بعد", "قبل", "لماذا", "كيف", "متي",
    },
    "darija": {
        "في", "من", "على", "ولا", "و", "كان", "هذا", "هاذي", "هذي", "هاذا", "انا", "عندي", "عندك", "نجم",
        "تنجم", "تنجمي", "باش", "اللي", "الي", "ما", "هل", "مع", "بعد", "قبل", "شنوه", "شنوة", "يا",
    },
}


# Mots interrogatifs : utiles pour départager, mais jamais suffisants pour désigner un sujet.
WEAK_WORDS = {
    "comment", "pourquoi", "quand", "combien", "quel", "quelle", "quels", "quelles", "ou",
    "كيف", "كيفاش", "لماذا", "علاش", "متي", "وقتاش", "قداش", "كم", "شحال", "شكون", "من",
}


def normalize(text: str) -> str:
    """Minuscules, accents français retirés, écritures arabes unifiées, ponctuation neutralisée."""
    text = text.replace("’", "'").replace("'", " ")
    text = _ARABIC_DIACRITICS.sub("", text)
    text = text.translate(_ARABIC_MAP)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.lower().strip()


def _stem(token: str) -> str:
    if token.isascii():
        if len(token) > 4 and token.endswith(("s", "x")):
            return token[:-1]
        return token
    for prefix in ("وال", "بال", "فال", "كال"):  # « بالدم » -> « دم »
        if len(token) > 4 and token.startswith(prefix):
            return token[3:]
    if len(token) > 3 and token.startswith(("لل", "ال")):
        return token[2:]
    return token


def tokens(text: str) -> list[str]:
    """Jetons normalisés (sans les mots vides, sans les mots d'une seule lettre)."""
    stop = STOPWORDS["fr"] | STOPWORDS["ar"] | STOPWORDS["darija"]
    out = []
    for raw in _SPLIT.split(normalize(text)):
        if len(raw) < 2 or raw.isdigit():
            continue
        if raw in stop:
            continue
        out.append(_stem(raw))
    return out
