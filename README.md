# Traductor PDF

Prototipo de lector PDF en Tauri 2 y Vite. Abre un PDF con texto seleccionable y muestra la traducción sobre la línea o palabra original. Se pueden mantener varias traducciones de línea abiertas. El idioma de destino se elige en la cabecera. Al abrir un documento con la API configurada se envía una muestra de páginas representativas para estimar y mostrar el idioma principal; la detección puede fallar y consume una solicitud adicional.

Los PDFs abiertos se guardan localmente en la biblioteca del WebView (IndexedDB) y se pueden volver a abrir desde **PDF guardados**. El botón **Cerrar PDF** cierra el libro actual sin borrarlo de la biblioteca.

Al recargar, la aplicación intenta recuperar el documento abierto, la página, el aumento y la posición de lectura. Las traducciones mostradas no se conservan al recargar.

## Requisitos

- Node.js, Rust y los [requisitos de Tauri para Windows](https://tauri.app/start/prerequisites/), incluidos Microsoft C++ Build Tools y WebView2.
- Una clave de la API de Gemini para traducir.

```sh
npm ci
npm run tauri dev
npm run tauri build
```

En Windows el comando genera los instaladores configurados; en macOS se ejecuta desde un Mac con las herramientas de Xcode. Para Android, instala Android Studio con SDK, NDK y Java, configura `ANDROID_HOME` y `NDK_HOME`, y ejecuta:

```sh
npm run android:init
npm run tauri icon app-icon.png
npm run android:dev
npm run android:build
```

Se han generado un instalador EXE y uno MSI para Windows x64 en `src-tauri/target/release/bundle/`; todavía no se han verificado la instalación ni el funcionamiento completo. No están firmados digitalmente. Esta carpeta está excluida de Git.

El flujo de GitHub Actions ha compilado Windows, macOS y Android y guarda sus artefactos. El APK de CI es de depuración; para distribuirlo hay que configurar la firma de lanzamiento. Los instaladores y el funcionamiento de la aplicación todavía necesitan probarse en cada plataforma.

El icono original está en `app-icon.png`; los tamaños generados por Tauri están en `src-tauri/icons/`.

## Conexión de la API

En **Conectar API**, introduce y guarda tu clave de Gemini. La aplicación usa el endpoint compatible de Gemini con `gemini-3.5-flash-lite`. Los costes y límites dependen del plan y proyecto de Google.

La clave se guarda actualmente en el almacenamiento local del WebView, sin cifrado específico. No se ha verificado una llamada real con la clave del usuario.

## Limitaciones actuales

- La traducción requiere red; el motor offline aún no está integrado en la interfaz.
- Los PDFs escaneados sin texto seleccionable necesitan OCR, que todavía no está integrado.
- Las traducciones superpuestas se ajustan al espacio disponible y pueden verse pequeñas o abreviadas. En PDF con fondos, columnas o diseños complejos la colocación puede no ser precisa. El PDF guardado no se modifica.
- Los comandos Rust de almacenamiento y caché existen, pero la interfaz actual no los utiliza. La caché persistente y la exportación de PDF modificado están pendientes de integración.
- La alineación de controles y las llamadas reales a Gemini requieren pruebas en la aplicación Windows.

## Comprobaciones

```sh
npm test
npm run build
```

Las pruebas no sustituyen una comprobación visual con PDFs reales ni una prueba de la API con una clave válida.

