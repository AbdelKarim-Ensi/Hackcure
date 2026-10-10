"""Service IA de Damm (T16) : assistant donneur en français, arabe et darija."""
from fastapi import FastAPI

from . import __version__
from .schemas import ChatRequest, ChatResponse, HealthResponse
from .texts import DISCLAIMERS, STUB_ANSWERS

app = FastAPI(
    title="Damm : service IA",
    version=__version__,
    description="Assistant donneur. Informations générales uniquement : aucune décision médicale.",
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Permet au backend et à Docker de vérifier que le service tourne."""
    return HealthResponse(status="ok", service="damm-ai", version=__version__)


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """Étape 1 : réponse fixe. La recherche dans la base de connaissances arrive à l'étape 3."""
    language = "fr" if req.language == "auto" else req.language
    return ChatResponse(
        answer=STUB_ANSWERS[language],
        language=language,
        intent="stub",
        sources=[],
        needs_staff=False,
        disclaimer=DISCLAIMERS[language],
    )
