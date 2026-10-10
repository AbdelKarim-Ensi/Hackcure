"""Langue de la réponse. Version simple (étape 3) ; l'étape 5 la remplacera par une vraie détection."""
import re

_ARABIC = re.compile(r"[\u0600-\u06FF]")


def resolve_language(requested: str, message: str) -> str:
    """Langue explicite si fournie. Sinon : texte en lettres arabes -> darija (la voix du bot), sinon français."""
    if requested != "auto":
        return requested
    return "darija" if _ARABIC.search(message) else "fr"
