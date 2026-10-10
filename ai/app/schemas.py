"""Le contrat de l'API : ce que le backend (M1) envoie et ce qu'il reçoit en retour."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# fr = français, ar = arabe standard, darija = dialecte tunisien (écrit en lettres arabes)
Language = Literal["fr", "ar", "darija"]
Intent = Literal["stub", "faq", "escalate", "out_of_scope", "emergency"]


class ChatRequest(BaseModel):
    message: str = Field(..., description="Question du donneur", examples=["Puis-je donner si j'ai un tatouage ?"])
    language: Language | Literal["auto"] = Field(
        "auto", description="Langue de la réponse. « auto » = détection à partir du message."
    )
    session_id: str | None = Field(None, max_length=64, description="Identifiant de conversation (optionnel).")

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Le message ne peut pas être vide")
        if len(v) > 500:
            raise ValueError("Le message dépasse 500 caractères")
        return v


class Source(BaseModel):
    """Entrée de la base de connaissances qui justifie la réponse."""

    id: str
    title: str


class ChatResponse(BaseModel):
    answer: str
    language: Language
    intent: Intent = Field(description="Ce que le bot a compris : faq, escalate, out_of_scope, emergency…")
    sources: list[Source] = Field(default_factory=list)
    needs_staff: bool = Field(False, description="Vrai si la question doit être confiée au personnel médical.")
    disclaimer: str = Field(description="Rappel affiché sous chaque réponse : le bot n'a aucune valeur médicale.")


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
