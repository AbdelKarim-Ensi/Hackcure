"""Service IA de Damm (T16) : assistant donneur en français, arabe et darija."""
from fastapi import FastAPI

from . import __version__
from .guardrails import check_emergency, check_medical_advice
from .kb import load_kb
from .language import resolve_language
from .llm import reword
from .schemas import ChatRequest, ChatResponse, HealthResponse, Source
from .search import KbSearch, is_confident
from .texts import DISCLAIMERS, FALLBACK_ANSWERS

app = FastAPI(
    title="Damm : service IA",
    version=__version__,
    description="Assistant donneur. Informations générales uniquement : aucune décision médicale.",
)

_search = KbSearch(load_kb())


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Permet au backend et à Docker de vérifier que le service tourne."""
    return HealthResponse(status="ok", service="damm-ai", version=__version__)


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """Urgence d'abord, puis base de connaissances, puis refus des conseils médicaux personnels."""
    language = resolve_language(req.language, req.message)

    # 1. Urgence : toujours en premier, avant toute recherche
    emergency = check_emergency(req.message, language)
    if emergency.triggered:
        return ChatResponse(
            answer=emergency.answer,
            language=language,
            intent="emergency",
            sources=[],
            needs_staff=True,
            disclaimer=DISCLAIMERS[language],
        )

    # 2. Base de connaissances
    matches = _search.search(req.message)
    if is_confident(matches):
        entry = matches[0].entry
        answer = getattr(entry.answer, language)
        # Étape 5 (optionnelle) : on reformule UNIQUEMENT une réponse validée qui n'est pas
        # une escalade. Si le LLM est désactivé, en erreur ou rejeté, on garde le texte validé.
        if not entry.needs_staff and getattr(entry, "validated", False):
            answer = reword(req.message, answer, language) or answer
        return ChatResponse(
            answer=answer,
            language=language,
            intent="escalate" if entry.needs_staff else "faq",
            sources=[Source(id=entry.id, title=entry.topic)],
            needs_staff=entry.needs_staff,
            disclaimer=DISCLAIMERS[language],
        )

    # 3. Pas de réponse validée : on refuse le conseil médical personnel
    advice = check_medical_advice(req.message, language)
    if advice.triggered:
        return ChatResponse(
            answer=advice.answer,
            language=language,
            intent="escalate",
            sources=[],
            needs_staff=True,
            disclaimer=DISCLAIMERS[language],
        )

    # 4. Hors sujet
    return ChatResponse(
        answer=FALLBACK_ANSWERS[language],
        language=language,
        intent="out_of_scope",
        sources=[],
        needs_staff=False,
        disclaimer=DISCLAIMERS[language],
    )
