# Bundled OCR components

- Tesseract.js 7.0.0 — https://github.com/naptha/tesseract.js — Apache-2.0, see LICENSE-tesseract.js.txt.
- tesseract.js-core 7.0.0 — https://github.com/naptha/tesseract.js-core — Apache-2.0, see LICENSE-core.txt and UPSTREAM-core-README.md.
- English language model — https://github.com/tesseract-ocr/tessdata_fast, downloaded from https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata on 27 October 2026 — Apache-2.0, see LICENSE-language-model.txt.

Files were copied from the available bundled runtime or the official language-model repository. Component code/model files are unmodified. Exact bundled-file hashes are recorded in the candidate's SHA256SUMS.txt. Runtime OCR uses these same-origin files rather than the libraries' default CDN paths.
