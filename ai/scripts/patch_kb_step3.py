"""Ajoute 4 mots-clés à l'entrée « securite-du-don » sans toucher au reste de la base (relectures conservées).
Usage : python3 scripts/patch_kb_step3.py   (idempotent : peut être relancé sans risque)"""
import json
from pathlib import Path

path = Path(__file__).resolve().parent.parent / "data" / "knowledge_base.json"
data = json.loads(path.read_text(encoding="utf-8"))
extra = {"fr": ["douloureux"], "ar": ["مؤلم", "وجع"], "darija": ["يوجع"]}
added = 0
for entry in data["entries"]:
    if entry["id"] == "securite-du-don":
        for lang, words in extra.items():
            for w in words:
                if w not in entry["keywords"][lang]:
                    entry["keywords"][lang].append(w)
                    added += 1
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"{added} mot(s)-clé(s) ajouté(s)")
