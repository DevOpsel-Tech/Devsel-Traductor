export function renderShell(root) {
  root.innerHTML = `
    <div class="flex h-full flex-col bg-[#f4f6fa]">
      <header class="z-10 flex h-[62px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-4 sm:px-6">
        <div class="header-brand flex min-w-0 items-center gap-3">
          <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="M4.5 5.5c3.4-.9 6.2-.3 7.5 1.2v12c-1.3-1.5-4.1-2.1-7.5-1.2zM19.5 5.5c-3.4-.9-6.2-.3-7.5 1.2v12c1.3-1.5 4.1-2.1 7.5-1.2z"/>
            </svg>
          </div>
          <div class="min-w-0">
            <div class="max-w-full truncate text-[15px] font-semibold tracking-tight text-slate-900">traductor pdf: &lt;&lt; $elu &gt;&gt;</div>
            <div id="documentName" class="max-w-[40vw] truncate text-[11px] text-slate-500">Espacio de lectura personal</div>
          </div>
        </div>
        <div class="header-actions flex shrink-0 items-center gap-2">
          <button id="libraryButton" class="icon-button header-action-library" type="button" title="Ver archivos subidos">
            <span aria-hidden="true">▣</span><span>Archivos subidos</span>
          </button>
          <button id="vocabularyButton" class="icon-button header-action-vocabulary" type="button" title="Abrir vocabulario">
            <span aria-hidden="true">▤</span><span>Vocabulario</span>
          </button>
          <button id="openDocumentButton" class="icon-button bg-indigo-600 text-white shadow-sm hover:bg-indigo-700" type="button" title="Subir PDF" aria-label="Subir PDF">
            <span aria-hidden="true">＋</span><span>Subir PDF</span>
          </button>
          <input id="fileInput" class="hidden" type="file" accept="application/pdf,.pdf" />
        </div>
      </header>

      <nav class="flex h-11 shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3 md:hidden" aria-label="Panel de lectura">
        <button id="mobileTranslationTab" type="button" class="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">Traducción</button>
        <button id="mobilePdfTab" type="button" class="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500">PDF original</button>
      </nav>

      <main id="readerMain" class="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(300px,42%)_minmax(0,1fr)]">
        <section id="translationPanel" class="flex min-h-0 flex-col border-r border-slate-200 bg-white" aria-label="Texto traducido al español">
          <div class="translation-toolbar shrink-0 border-b border-slate-100 bg-white px-3 py-1.5" role="toolbar" aria-label="Herramientas de lectura">
            <div class="translation-zoom-tools flex items-center gap-1">
              <button id="translationZoomOutButton" class="toolbar-button text-lg" type="button" title="Reducir zoom del texto" aria-label="Reducir zoom del texto" disabled>−</button>
              <button id="translationZoomValueButton" class="h-8 min-w-12 rounded-md px-1 text-xs tabular-nums text-slate-600 hover:bg-slate-100" type="button" title="Restablecer zoom del texto" disabled>100%</button>
              <button id="translationZoomInButton" class="toolbar-button text-lg" type="button" title="Aumentar zoom del texto" aria-label="Aumentar zoom del texto" disabled>＋</button>
            </div>
            <span id="translationStatus" class="translation-status" title="Las traducciones se guardan localmente en este dispositivo." aria-live="polite">Las traducciones se guardan localmente en este dispositivo.</span>
            <span id="translationPageLabel" class="translation-page-label">— / —</span>
            <div id="translationActions" class="translation-toolbar-actions">
              <button id="retranslateButton" class="icon-button hidden border border-slate-200 text-slate-600 hover:bg-slate-50" type="button">Volver a traducir</button>
              <button id="translatePageButton" class="icon-button bg-indigo-600 text-white hover:bg-indigo-700" type="button" disabled>Traducir página</button>
              <button id="saveReadingPdfButton" class="icon-button border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50" type="button" disabled title="Guardar PDF modificado">Guardar PDF modificado</button>
            </div>
            <div class="translation-view-tools flex items-center justify-end gap-1">
              <button id="translationSearchButton" class="toolbar-button" type="button" title="Buscar en este texto" aria-label="Buscar en este texto" disabled>⌕</button>
              <button id="translationDownloadButton" class="toolbar-button" type="button" title="Descargar PDF" aria-label="Descargar PDF" disabled>↓</button>
              <button id="translationFullscreenButton" class="toolbar-button" type="button" title="Pantalla completa del panel de lectura" aria-label="Pantalla completa del panel de lectura" disabled>⛶</button>
            </div>
          </div>
          <div id="translationSearchBar" class="hidden shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <input id="translationSearchInput" class="h-8 min-w-0 flex-1 rounded-md border border-slate-200 px-2.5 text-sm outline-none focus:border-indigo-400" type="search" placeholder="Buscar en el texto mostrado" aria-label="Buscar en el texto mostrado" />
            <span id="translationSearchCount" class="min-w-12 text-center text-xs tabular-nums text-slate-500" aria-live="polite">0 / 0</span>
            <button id="translationSearchPreviousButton" class="toolbar-button" type="button" title="Coincidencia anterior">↑</button>
            <button id="translationSearchNextButton" class="toolbar-button" type="button" title="Coincidencia siguiente">↓</button>
            <button id="translationSearchCloseButton" class="toolbar-button" type="button" title="Cerrar búsqueda">×</button>
          </div>
          <div id="translationContent" class="translation-content min-h-0 flex-1 overflow-auto px-5 py-6 sm:px-7">
            <div class="mx-auto mt-[min(14vh,120px)] max-w-sm text-center">
              <div class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600">↗</div>
              <h1 class="mt-5 text-lg font-semibold tracking-tight text-slate-800">Tu espacio de estudio</h1>
              <p class="mt-2 text-sm leading-6 text-slate-500">Abre un PDF para leer su traducción junto al documento original. El texto digital se extrae directamente; el OCR solo se ofrece cuando una página no contiene texto seleccionable.</p>
              <button id="emptyOpenButton" type="button" class="icon-button mt-5 bg-indigo-600 text-white hover:bg-indigo-700">Ver archivos subidos</button>
            </div>
          </div>
          <div id="translationNotice" class="hidden shrink-0 border-t border-slate-100 px-5 py-3 text-xs text-slate-500"></div>
        </section>

        <div id="panelResizer" class="panel-resizer" role="separator" aria-label="Ajustar el ancho de los paneles" aria-orientation="vertical" aria-valuenow="42" tabindex="0" title="Arrastra para ajustar el ancho de los paneles"></div>

        <section id="pdfPanel" class="flex min-h-0 min-w-0 flex-col bg-slate-100" aria-label="Documento PDF original">
          <div class="flex min-h-[58px] shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 bg-white px-3 sm:px-4">
            <div class="flex items-center gap-1">
              <button id="previousPageButton" class="toolbar-button" type="button" title="Página anterior" aria-label="Página anterior" disabled>‹</button>
              <input id="pageInput" class="h-8 w-12 rounded-md border border-slate-200 text-center text-xs tabular-nums outline-none focus:border-indigo-400" type="number" min="1" value="1" aria-label="Página actual" disabled />
              <span class="text-xs text-slate-400">/ <span id="pageCount">—</span></span>
              <button id="nextPageButton" class="toolbar-button" type="button" title="Página siguiente" aria-label="Página siguiente" disabled>›</button>
            </div>
            <div class="flex items-center gap-1">
              <button id="zoomOutButton" class="toolbar-button text-lg" type="button" title="Reducir zoom" aria-label="Reducir zoom" disabled>−</button>
              <button id="zoomValueButton" class="h-8 min-w-12 rounded-md px-1 text-xs tabular-nums text-slate-600 hover:bg-slate-100" type="button" title="Restablecer al 100 % del ancho visible" disabled>100%</button>
              <button id="zoomInButton" class="toolbar-button text-lg" type="button" title="Aumentar zoom" aria-label="Aumentar zoom" disabled>＋</button>
              <button id="fitPageButton" class="toolbar-button" type="button" title="Ajustar página al marco" aria-label="Ajustar página al marco" disabled>□</button>
              <button id="rotateButton" class="toolbar-button" type="button" title="Girar página" aria-label="Girar página" disabled>↻</button>
            </div>
            <div class="flex items-center gap-1">
              <button id="toggleSearchButton" class="toolbar-button" type="button" title="Buscar en el PDF (Ctrl+F)" aria-label="Buscar en el PDF" disabled>⌕</button>
              <button id="downloadButton" class="toolbar-button" type="button" title="Descargar PDF" aria-label="Descargar PDF" disabled>↓</button>
              <button id="printButton" class="toolbar-button" type="button" title="Imprimir PDF" aria-label="Imprimir PDF" disabled>▤</button>
              <button id="fullscreenButton" class="toolbar-button" type="button" title="Pantalla completa" aria-label="Pantalla completa" disabled>⛶</button>
            </div>
          </div>
          <div id="searchBar" class="hidden shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
            <input id="searchInput" class="h-8 min-w-0 flex-1 rounded-md border border-slate-200 px-2.5 text-sm outline-none focus:border-indigo-400" type="search" placeholder="Buscar en el documento" aria-label="Buscar texto en el PDF" />
            <span id="searchCount" class="min-w-12 text-center text-xs tabular-nums text-slate-500">0 / 0</span>
            <button id="searchPreviousButton" class="toolbar-button" type="button" title="Coincidencia anterior">↑</button>
            <button id="searchNextButton" class="toolbar-button" type="button" title="Coincidencia siguiente">↓</button>
            <button id="closeSearchButton" class="toolbar-button" type="button" title="Cerrar búsqueda">×</button>
          </div>
          <div id="readerContainer" class="reader-container min-h-0 flex-1">
            <div id="viewerContainer">
              <div id="viewer" class="pdfViewer"></div>
            </div>
            <div id="pdfEmptyState" class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
              <div class="max-w-xs text-center">
                <div class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-xl text-slate-400 shadow-sm">▧</div>
                <p class="mt-4 text-sm font-medium text-slate-600">El documento original aparecerá aquí</p>
                <p class="mt-1 text-xs leading-5 text-slate-400">El visor mantiene todas las páginas en desplazamiento continuo.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>

    <div id="selectionMenu" class="selection-menu hidden" role="toolbar" aria-label="Acciones para el texto seleccionado">
      <button data-selection-action="translate" type="button">Traducir al español</button>
      <button data-selection-action="translateToEnglish" class="hidden" type="button">Traducir al inglés</button>
      <button data-selection-action="explain" type="button">Explicar</button>
      <button data-selection-action="copy" type="button">Copiar</button>
      <button data-selection-action="vocabulary" type="button" aria-describedby="vocabularyActionTooltip">
        Añadir
        <span id="vocabularyActionTooltip" class="selection-menu-tooltip" role="tooltip">
          <strong>Vocabulario</strong>
          <span>Añadir la palabra seleccionada al vocabulario</span>
        </span>
      </button>
    </div>

    <dialog id="libraryDialog" class="centered-dialog library-dialog w-[min(92vw,680px)] rounded-2xl border border-slate-200 p-0 shadow-2xl">
      <div class="dialog-drag-handle flex items-center justify-between border-b border-slate-100 px-5 py-4" data-dialog-drag-handle>
        <div class="min-w-0"><h2 id="libraryTitle" class="font-semibold text-slate-900">Archivos subidos</h2><p class="mt-0.5 text-xs text-slate-500">Abre y continúa editando cualquiera de tus PDF.</p></div>
        <button id="closeLibraryButton" class="toolbar-button text-xl" type="button" aria-label="Cerrar archivos subidos">×</button>
      </div>
      <div id="libraryList" class="library-list max-h-[65vh] overflow-auto p-4" aria-live="polite"></div>
      <section class="border-t border-slate-100">
        <div class="px-5 pt-4">
          <h3 class="text-sm font-semibold text-slate-800">Archivos modificados</h3>
          <p class="mt-1 text-xs text-slate-500">Abre un PDF guardado para seguir editándolo y guardarlo de nuevo.</p>
        </div>
        <div id="modifiedReadingsList" class="max-h-[28vh] overflow-auto p-4" aria-live="polite"></div>
      </section>
      <div class="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
        <span class="min-w-0 text-xs text-slate-500">Tus PDF se guardan en este dispositivo.</span>
        <button id="libraryUploadButton" class="icon-button shrink-0 bg-indigo-600 text-white hover:bg-indigo-700" type="button">＋ Subir otro PDF</button>
      </div>
    </dialog>

    <dialog id="vocabularyDialog" class="centered-dialog vocabulary-dialog w-[min(92vw,560px)] rounded-2xl border p-0 shadow-2xl">
      <div class="vocabulary-dialog-header dialog-drag-handle" data-dialog-drag-handle>
        <div><h2>Mi vocabulario</h2><p>Palabras guardadas en este navegador.</p></div>
        <button id="closeVocabularyButton" class="toolbar-button text-xl" type="button" aria-label="Cerrar vocabulario">×</button>
      </div>
      <div id="vocabularyList" class="max-h-[65vh] overflow-auto p-4"></div>
    </dialog>

    <div id="toast" class="pointer-events-none fixed bottom-5 left-1/2 z-40 hidden max-w-[90vw] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg" role="status" aria-live="polite"></div>
  `;
}
