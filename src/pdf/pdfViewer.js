import * as pdfjsLib from "pdfjs-dist";
import {
  EventBus,
  PDFFindController,
  PDFLinkService,
  PDFViewer,
} from "pdfjs-dist/web/pdf_viewer.mjs";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { extractPageText } from "./extractPageText.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export class PdfReader {
  #container;
  #viewerElement;
  #eventBus;
  #document = null;
  #loadingTask = null;
  #pageText = new Map();
  #pageHasImages = new Map();
  #pageChange;
  #findCountChange;

  constructor(container, viewerElement, { onPageChange, onFindCountChange }) {
    this.#container = container;
    this.#viewerElement = viewerElement;
    this.#pageChange = onPageChange;
    this.#findCountChange = onFindCountChange;
    this.#eventBus = new EventBus();
    const linkService = new PDFLinkService({ eventBus: this.#eventBus });
    const findController = new PDFFindController({ eventBus: this.#eventBus, linkService });
    this.viewer = new PDFViewer({
      container,
      viewer: viewerElement,
      eventBus: this.#eventBus,
      linkService,
      findController,
      enablePermissions: false,
    });
    linkService.setViewer(this.viewer);
    this.findController = findController;
    this.linkService = linkService;
    this.#eventBus.on("pagechanging", ({ pageNumber }) => this.#pageChange?.(pageNumber));
    this.#eventBus.on("scalechanging", ({ scale }) => this.onScaleChange?.(scale));
    this.#eventBus.on("textlayerrendered", ({ pageNumber }) =>
      this.onTextLayerRendered?.(pageNumber),
    );
    this.#eventBus.on("updatefindmatchescount", ({ matchesCount }) =>
      this.#findCountChange?.(matchesCount),
    );
  }

  async open(fileUrl) {
    if (this.#loadingTask) {
      this.viewer.setDocument(null);
      await this.#loadingTask.destroy();
    }
    this.#loadingTask = pdfjsLib.getDocument({ url: fileUrl });
    const document = await this.#loadingTask.promise;
    this.#document = document;
    this.#pageText.clear();
    this.#pageHasImages.clear();
    this.linkService.setDocument(document, fileUrl);
    const pagesInitialized = new Promise((resolve) => {
      this.#eventBus.on("pagesinit", resolve, { once: true });
    });
    this.viewer.setDocument(document);
    await pagesInitialized;
    this.viewer.currentScaleValue = "page-width";
    return document.numPages;
  }

  async close() {
    this.viewer.setDocument(null);
    this.linkService.setDocument(null);
    this.#document = null;
    this.#pageText.clear();
    this.#pageHasImages.clear();
    if (this.#loadingTask) {
      const loadingTask = this.#loadingTask;
      this.#loadingTask = null;
      await loadingTask.destroy();
    }
  }

  get currentPage() {
    return this.viewer.currentPageNumber || 1;
  }

  get pageCount() {
    return this.#document?.numPages ?? 0;
  }

  get scale() {
    return this.viewer.currentScale;
  }

  get scaleMode() {
    return this.viewer.currentScaleValue;
  }

  get rotation() {
    return this.viewer.pagesRotation;
  }

  get document() {
    return this.#document;
  }

  goToPage(page) {
    if (Number.isSafeInteger(page) && page >= 1 && page <= this.pageCount) {
      this.viewer.currentPageNumber = page;
    }
  }

  setScale(scale) {
    this.viewer.currentScaleValue = scale;
  }

  setRotation(rotation) {
    this.viewer.pagesRotation = rotation;
  }

  startSearch(query, findPrevious = false) {
    this.#eventBus.dispatch("find", {
      source: this,
      type: "find",
      query,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious,
    });
  }

  searchAgain(findPrevious = false) {
    this.#eventBus.dispatch("find", {
      source: this,
      type: "again",
      query: "",
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious,
    });
  }

  async getPageText(pageNumber) {
    if (this.#pageText.has(pageNumber)) {
      return this.#pageText.get(pageNumber);
    }
    const page = await this.#document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = extractPageText(content.items);
    const operators = await page.getOperatorList();
    const imageOperators = new Set(
      [
        pdfjsLib.OPS.paintImageXObject,
        pdfjsLib.OPS.paintInlineImageXObject,
        pdfjsLib.OPS.paintImageMaskXObject,
        pdfjsLib.OPS.paintImageMaskXObjectGroup,
        pdfjsLib.OPS.paintSolidColorImageMask,
      ].filter(Number.isInteger),
    );
    this.#pageHasImages.set(pageNumber, operators.fnArray.some((fn) => imageOperators.has(fn)));
    this.#pageText.set(pageNumber, text);
    return text;
  }

  hasPageImages(pageNumber) {
    return this.#pageHasImages.get(pageNumber) === true;
  }

  download(name) {
    if (!this.#document) {
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = this.#document.getUrl();
    anchor.download = name;
    anchor.click();
  }

  async print(fileUrl) {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.src = fileUrl;
    frame.addEventListener(
      "load",
      () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        window.setTimeout(() => frame.remove(), 60_000);
      },
      { once: true },
    );
    document.body.append(frame);
  }
}
