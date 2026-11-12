# TRADUCTOR PDF

Personal PDF reader with Spanish translation, on-demand OCR, contextual study help, and a browser-local vocabulary list.

## Requirements

- Node.js 24 or newer
- A local LibreTranslate-compatible endpoint for translation

The project was built and checked with Node.js 24.11.1, Express 5.2.1, PDF.js 6.4.299, Vite 8.3.2, Tailwind CSS 4.3.3, and Tesseract.js 7.0.0.

## Run locally

```sh
npm install
npm run dev
```

The Vite client runs at `http://127.0.0.1:5173`; its `/api` requests are proxied to Express on port 3000. To translate, start a local LibreTranslate-compatible engine on port 5000. For example, a local LibreTranslate instance can be started with:

```sh
docker run --rm -p 5000:5000 libretranslate/libretranslate --load-only en,es
```

The application never silently switches to a remote translation provider. If the local engine is unavailable, the UI displays the connection error.

Copy `.env.example` to `.env` to change the API port or translation endpoint. For a key-protected local engine, set `LIBRETRANSLATE_API_KEY`.

## Production

```sh
npm run build
npm start
```

`npm start` serves the built client and API from the same Express process.

Use **Archivos subidos** in the app header to reopen a previously uploaded PDF or remove one. Removing a file requires confirmation and also deletes its translation/OCR caches. Files not explicitly removed remain in the local `data/` directory across application restarts.

## Architecture

```text
src/
  api/                 Browser-to-API requests
  classification/      Code and study-content classification
  ocr/                 On-demand, in-browser OCR
  pdf/                 PDF.js official viewer integration
  reading/             Selection-based reading changes and range mapping
  study/               Browser-local vocabulary
  ui/                  Reader layout and safe content rendering
server/
  routes/              Upload, page cache, translation, selection APIs
  services/
    translation/       Pluggable translation adapter and LibreTranslate
    study/             Contextual explanation rules
    documentStore.js   Local PDF files and metadata
    fileCache.js       Page translation, OCR, and reading-change storage
test/                  Node.js unit tests
```

PDF.js's installed `PDFViewer`, `PDFFindController`, `PDFLinkService`, official viewer stylesheet, and matching worker are used for the continuous-scroll viewer, text layer, selection, search, and zoom. The app extracts page text from PDF.js and requests only the selected page's translation. Pages without extracted text are checked for image operators before OCR is offered; OCR runs only after an explicit action and is cached per document and page.

The reading panel shows the Spanish translation beside the original PDF, so the extracted-original tab is not duplicated. Its compact toolbar keeps text zoom, page position, translation status, page translation, saving, search, download, and fullscreen controls together. Headings, lists, and tab-separated rows retain their structure in the translated page.

The original PDF opens at **100%** of the visible panel width for a larger, easier-to-read page with vertical scrolling. Its zoom buttons adjust relative to that baseline; **Ajustar pÃ¡gina al marco** fits the whole page in the available height. Search, download, and fullscreen remain available.

Selected text is translated directly in place: selections from the PDF appear as overlays on the matching PDF text, while selections from the Spanish page update the reading text. Hover or focus a changed phrase to reveal its individual undo action. Changes are stored independently by document, page, and reading language; they do not alter the uploaded PDF or cached full-page translation. Use **Guardar PDF modificado** to save the most recently edited variant on the current page as a new PDF: untouched pages retain their source pages and changed pages are reflowed with their saved reading text. Saved PDFs appear under **Archivos modificados**, with explicit **Abrir** and **Eliminar** actions. An opened saved PDF can be read, edited, and saved as another modified PDF; each saved revision remains separately archived.

Uploaded PDFs, metadata, OCR text, and translations are stored under the ignored `data/` directory. Vocabulary stays in the browser's local storage. OCR runs in the browser; Tesseract.js downloads its English recognition data when OCR is first used.

PDF.js search indexes the PDF's own text. Recognized OCR text is selectable in the Spanish panel and can be translated or explained, but it is not injected into the PDF.js search index.

## API

- `GET /api/health`
- `GET /api/documents` â€” list PDFs stored on this device
- `GET /api/documents/modified` â€” list saved modified readings by document, language, and page
- `POST /api/documents/modified-pdf` â€” archive a generated modified-reading PDF (`file`, `sourceDocumentId`, `variant`, and JSON `pages`)
- `POST /api/documents` â€” upload a PDF (`multipart/form-data`, field `file`; 50 MB limit)
- `GET /api/documents/:id` â€” document metadata
- `GET /api/documents/:id/file` â€” PDF with browser range support
- `GET /api/documents/:id/pages/:page` â€” cached OCR text for a page
- `POST /api/documents/:id/pages/:page/translate` â€” translate/cache a page (`sourceText`, optional `force`)
- `POST /api/documents/:id/pages/:page/ocr` â€” save/cache OCR text
- `GET /api/documents/:id/pages/:page/edits` â€” list saved Original and Spanish reading edits
- `POST /api/documents/:id/pages/:page/edits` â€” save an individual selection replacement or below-line addition
- `DELETE /api/documents/:id/pages/:page/edits/:editId?variant=original|spanish` â€” undo one edit
- `DELETE /api/documents/:id` â€” remove a document and its caches
- `POST /api/selections/translate` â€” translate selected text to Spanish by default, or English with `target: "en"`
- `POST /api/selections/explain`

## Checks

```sh
npm test
npm run build
```


## Tecnologías

- JavaScript (Node.js + Express + pdf-lib + Tesseract.js OCR + Vite)
