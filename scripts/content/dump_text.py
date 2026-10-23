"""Print a page's text layer. Usage: dump_text.py en|hi <pdf_page>. The Hindi layer is BROKEN for letters (use only for digits/numbers); read Hindi words from the image."""
import sys, fitz
f = {"en": "Report-38-of-2025_English.pdf", "hi": "Report-38-of-2025_Hindi.pdf"}[sys.argv[1]]
print(fitz.open("../../reference/sample-report/" + f)[int(sys.argv[2]) - 1].get_text())
