"""Service IA de Damm (T16) : assistant donneur en français, arabe et darija."""
from fastapi import FastAPI

from . import __version__
from .kb import load_kb
from .language import resolve_language
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
    """Cherche la question dans la base de connaissances. Si rien ne correspond assez, il le dit."""
    language = resolve_language(req.language, req.message)
    matches = _search.search(req.message)

    if is_confident(matches):
        entry = matches[0].entry
        return ChatResponse(
            answer=getattr(entry.answer, language),
            language=language,
            intent="escalate" if entry.needs_staff else "faq",
            sources=[Source(id=entry.id, title=entry.topic)],
            needs_staff=entry.needs_staff,
            disclaimer=DISCLAIMERS[language],
        )

    return ChatResponse(
        answer=FALLBACK_ANSWERS[language],
        language=language,
        intent="out_of_scope",
        sources=[],
        needs_staff=False,
        disclaimer=DISCLAIMERS[language],
    )
