from pathlib import Path

path = Path("awards_seed.json")
text = path.read_text(encoding="utf-8")
path.write_text(text.replace("LeVeon Bell", "Le'Veon Bell"), encoding="utf-8")
print("fixed Le'Veon Bell spelling")
