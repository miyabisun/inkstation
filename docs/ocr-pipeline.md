# OCR Pipeline

## Flow

```
[Browser]                              [Server]
    |                                      |
    |  edit-row (SVG base64) ---------->   |
    |                               (1) Decode base64 → SVG file
    |                               (2) SVG → PNG (resvg)
    |                               (3) PNG → NDLOCR-Lite
    |                               (4) Parse XML → text
    |                               (5) Update page YAML
    |  <---- ocr-result                    |
```

## resvg

- CLI-based SVG renderer
- Converts SVG → PNG for OCR input
- Replaces CairoSVG (Python library) from inkport

## NDLOCR-Lite

- CLI-based OCR engine
- Supports: Japanese print/handwritten, English print/handwritten, vertical writing
- CPU-only, no GPU required
- Repository: https://github.com/ndl-lab/ndlocr-lite

## Pressure Data Handling

The client converts 4096-level stylus pressure to `stroke-width` values in the SVG **before sending**. The server rasterizes the SVG as-is via resvg — no pressure interpretation is done server-side.

## OCR Scanning Effect

While waiting for an `ocr-result` response, the row displays a scanning animation:

1. The client calculates the **bounding box** of the stroke data to determine the written area
2. The written area is rendered as the cropped SVG with a subtle **border**
3. A **blue scanning line** animates from top to bottom, resembling a document scanner
4. The animation loops until the `ocr-result` is received
5. On `ocr-result`: the scanning effect is removed and the recognized text replaces the SVG

The effect covers **only the written portion** of the row (not the full row width).
