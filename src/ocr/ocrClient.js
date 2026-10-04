import { createWorker } from "tesseract.js";

let workerPromise;

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      logger: (message) => {
        if (message.status === "recognizing text" && Number.isFinite(message.progress)) {
          onProgress?.(message.progress);
        }
      },
    }).catch((error) => {
      workerPromise = undefined;
      throw error;
    });
  }
  return workerPromise;
}

export async function recognizePage(pdfDocument, pageNumber, onProgress) {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("No se pudo preparar la imagen de la página para OCR.");
  }

  try {
    await page.render({ canvasContext: context, viewport }).promise;
    const worker = await getWorker(onProgress);
    const result = await worker.recognize(canvas);
    const text = result.data.text.trim();
    if (!text) {
      throw new Error("El OCR no encontró texto legible en esta página.");
    }
    return text;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
  }
}
