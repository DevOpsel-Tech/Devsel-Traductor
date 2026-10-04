async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `Error HTTP ${response.status}.`;
    try {
      const body = await response.json();
      message = body.error ?? message;
    } catch {
      // Some network and proxy errors do not return JSON.
    }
    throw new Error(message);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export async function uploadDocument(file) {
  const body = new FormData();
  body.append("file", file);
  return request("/api/documents", { method: "POST", body });
}

export async function saveModifiedPdf(file, sourceDocumentId, variant, pages) {
  const body = new FormData();
  body.append("file", file);
  body.append("sourceDocumentId", sourceDocumentId);
  body.append("variant", variant);
  body.append("pages", JSON.stringify(pages));
  return request("/api/documents/modified-pdf", { method: "POST", body });
}

export async function listDocuments() {
  return request("/api/documents");
}

export async function listModifiedReadings() {
  return request("/api/documents/modified");
}

export async function deleteDocument(documentId) {
  return request(`/api/documents/${encodeURIComponent(documentId)}`, { method: "DELETE" });
}

export async function getPageReadingEdits(documentId, page) {
  return request(`/api/documents/${encodeURIComponent(documentId)}/pages/${page}/edits`);
}

export async function addPageReadingEdit(documentId, page, edit) {
  return request(`/api/documents/${encodeURIComponent(documentId)}/pages/${page}/edits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(edit),
  });
}

export async function deletePageReadingEdit(documentId, page, variant, editId) {
  return request(
    `/api/documents/${encodeURIComponent(documentId)}/pages/${page}/edits/${encodeURIComponent(editId)}?variant=${encodeURIComponent(variant)}`,
    { method: "DELETE" },
  );
}

export async function getPageData(documentId, page) {
  return request(`/api/documents/${encodeURIComponent(documentId)}/pages/${page}`);
}

export async function translatePage(documentId, page, sourceText, force = false) {
  return request(`/api/documents/${encodeURIComponent(documentId)}/pages/${page}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceText, force }),
  });
}

export async function saveOcr(documentId, page, text) {
  return request(`/api/documents/${encodeURIComponent(documentId)}/pages/${page}/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export async function translateSelection(text, target = "es", source = "auto") {
  return request("/api/selections/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source, target }),
  });
}

export async function explainSelection(text, context = "") {
  return request("/api/selections/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, context }),
  });
}
