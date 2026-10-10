"""Base de connaissances : chargement et validation.

Chaque entrée existe en français, arabe (standard) et darija. Une entrée `validated: true`
doit citer sa `source` (centre de transfusion, document officiel...). Tant que ce n'est pas le cas,
le texte ne contient aucun chiffre médical : durées, âges et poids restent dans les règles
(`backend/src/rules/`) et sont communiqués par l'application, jamais par le bot.
"""
import json
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, model_validator

KB_PATH = Path(__file__).resolve().parent.parent / "data" / "knowledge_base.json"
LANGS = ("fr", "ar", "darija")


class Localized(BaseModel):
    fr: str
    ar: str
    darija: str


class Keywords(BaseModel):
    fr: list[str]
    ar: list[str]
    darija: list[str]


class KbEntry(BaseModel):
    id: str
    topic: str
    needs_staff: bool = False
    validated: bool = False
    source: str | None = None
    question: Localized
    answer: Localized
    keywords: Keywords

    @model_validator(mode="after")
    def validated_requires_source(self) -> "KbEntry":
        if self.validated and not self.source:
            raise ValueError(f"{self.id}: une entrée validée doit citer sa source")
        return self


@lru_cache
def _load(path: str) -> tuple[KbEntry, ...]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return tuple(KbEntry(**e) for e in data["entries"])


def load_kb(path: Path | None = None) -> list[KbEntry]:
    return list(_load(str(path or KB_PATH)))
