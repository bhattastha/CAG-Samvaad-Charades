"""Re-crop a figure from the English PDF. Usage: crop.py <pdf_page> <x0,y0,x1,y1 in PDF points> <out.png>
Page images in work/img/en are rendered at 144 dpi, so PDF points = pixels / 2."""
import sys, fitz
d = fitz.open("../../reference/sample-report/Report-38-of-2025_English.pdf")
x0, y0, x1, y1 = [float(v) for v in sys.argv[2].split(",")]
d[int(sys.argv[1]) - 1].get_pixmap(clip=fitz.Rect(x0, y0, x1, y1), dpi=144).save(sys.argv[3])
print("saved", sys.argv[3])
