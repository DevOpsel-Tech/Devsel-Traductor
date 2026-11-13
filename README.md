# Traductor PDF

Aplicación de escritorio para leer PDF y traducir una palabra o línea sin modificar el documento original. Está construida con Tauri 2, Vite y PDF.js.

## Descargar para Windows

[Descargar instalador para Windows x64 (.exe)](https://github.com/DevOpsel-Tech/Devsel-Traductor/raw/refs/heads/main/downloads/TraductorPDF-Windows-x64-setup.exe)

[Descargar versión portable para Windows x64 (.zip)](https://github.com/DevOpsel-Tech/Devsel-Traductor/raw/refs/heads/main/downloads/TraductorPDF-Windows-x64-portable.zip)

Para la versión portable, extrae el ZIP y ejecuta `traductor-pdf.exe`. Requiere Microsoft Edge WebView2 Runtime. No instala la aplicación ni crea accesos directos.

Las versiones actuales no están firmadas digitalmente. Windows puede mostrar una advertencia de editor desconocido.

Los archivos son una versión de prueba y la instalación todavía no se ha verificado. El flujo de compilación genera artefactos de macOS y Android, pero aún no se ofrecen aquí como descargas finales.

## Funciones y limitaciones

- Abre PDF con texto seleccionable, guarda documentos localmente y recuerda la posición de lectura.
- Traduce palabras o líneas al idioma elegido y estima el idioma principal a partir de páginas representativas.
- Requiere conexión a Internet y una clave propia de Gemini. Google aplica sus límites y condiciones.
- Los PDF escaneados sin texto seleccionable necesitan OCR, que todavía no está integrado.
- Las traducciones se superponen en pantalla; la aplicación no modifica ni exporta un PDF traducido.

Consulta [Privacidad](./PRIVACY.md) antes de usar documentos sensibles.

## Ejecutar desde el código fuente

Requisitos:

- Node.js 24.
- Rust estable y los requisitos de compilación de [Tauri para Windows](https://tauri.app/start/prerequisites/), incluido Microsoft C++ Build Tools.
- Microsoft Edge WebView2 Runtime.

```sh
npm ci
npm test
npm run tauri dev
npm run tauri build
```

Los paquetes de Windows se generan en `src-tauri/target/release/bundle/`. Para compilar macOS se necesita macOS y Xcode. Las versiones de `package.json`, `src-tauri/Cargo.toml` y `src-tauri/tauri.conf.json` deben coincidir.

## Publicaciones y compilación continua

GitHub Actions ejecuta las pruebas y prepara compilaciones de Windows, macOS y Android. Los descargables de Windows de arriba se han añadido al repositorio; todavía no se ha publicado una versión en **Releases**.

Los artefactos de CI de Android son APK de depuración y no forman parte de las publicaciones de escritorio. No hay firma de lanzamiento para Android.

## API y almacenamiento

La clave de Gemini se guarda en el almacenamiento local de la aplicación sin cifrado específico. Los PDF se guardan en el almacenamiento local del WebView. Para detectar el idioma se envía una muestra de texto del documento a Gemini; al traducir, también se envía el texto seleccionado. No introduzcas claves en el código ni en incidencias públicas.

Consulta los detalles y opciones para borrar datos en [PRIVACY.md](./PRIVACY.md).

## Pruebas

```sh
npm test
npm run build
```

Las pruebas automatizadas no sustituyen la comprobación de los instaladores en Windows/macOS ni una prueba real de conexión con Gemini.

## Licencia

Este proyecto se distribuye bajo la licencia [MIT](./LICENSE).
