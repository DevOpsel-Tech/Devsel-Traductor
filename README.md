# Traductor PDF

Aplicación de escritorio para leer PDF y traducir una palabra o línea sin modificar el documento original. Está construida con Tauri 2, Vite y PDF.js.

## Descargar para Windows

[Descargar instalador para Windows x64 (.exe)](https://github.com/DevOpsel-Tech/Devsel-Traductor/raw/refs/heads/main/downloads/TraductorPDF-Windows-x64-setup.exe)

[Descargar versión portable para Windows x64 (.zip)](https://github.com/DevOpsel-Tech/Devsel-Traductor/raw/refs/heads/main/downloads/TraductorPDF-Windows-x64-portable.zip)

Para la versión portable, extrae el ZIP y ejecuta `traductor-pdf.exe`. Requiere Microsoft Edge WebView2 Runtime. No instala la aplicación ni crea accesos directos.

Las versiones actuales no están firmadas digitalmente. Windows puede mostrar una advertencia de editor desconocido ("Windows protegió tu PC"). Para instalar de todos modos: pulsa **Más información** → **Ejecutar de todas formas**.

Los archivos son una versión de prueba y la instalación todavía no se ha verificado. El flujo de compilación genera artefactos de macOS y Android, pero aún no se ofrecen aquí como descargas finales.

## Descargar para Android

La compilación de Android genera un APK de depuración. Puedes obtenerlo desde los **artefactos de GitHub Actions**:

1. Ve a [Actions](https://github.com/DevOpsel-Tech/Devsel-Traductor/actions).
2. Abre el último workflow exitoso.
3. Descarga el artefacto `traductor-android-debug` (archivo `.apk`).
4. En tu móvil, permite instalar apps de fuentes desconocidas y abre el APK.

> El APK de depuración no está firmado para lanzamiento. Para una versión final se necesita firma de release (pendiente).

## Funciones y limitaciones

- Abre PDF con texto seleccionable, guarda documentos localmente y recuerda la posición de lectura.
- Traduce palabras o líneas al idioma elegido y estima el idioma principal a partir de páginas representativas.
- Requiere Internet y una clave de API de Gemini, OpenAI, Anthropic, OpenRouter, DeepSeek, Mistral o Groq. Cada proveedor aplica sus propios precios, límites y condiciones; una suscripción de chat no incluye necesariamente acceso a su API.
- Los PDF escaneados sin texto seleccionable necesitan OCR, que todavía no está integrado.
- Las traducciones se superponen en pantalla; pulsa una traducción de línea para abrir el texto completo.
  La aplicación no modifica ni exporta un PDF traducido.

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

Los artefactos de CI de Android son APK de depuración y ahora se documentan arriba como descarga opcional. No hay firma de lanzamiento para Android.

## API y almacenamiento

Elige un proveedor en **Conectar API** e introduce su clave. La clave se mantiene solo en memoria durante la sesión y debe introducirse de nuevo al reiniciar o cambiar de proveedor. Una clave de Gemini guardada por una versión anterior se traslada a memoria y se elimina de la configuración local al arrancar. Los PDF se guardan en el almacenamiento local del WebView. Para detectar el idioma se envía una muestra de texto al proveedor elegido; al traducir, también se envía el texto seleccionado. OpenRouter puede enviar el texto al proveedor del modelo que seleccione. No introduzcas claves en el código ni en incidencias públicas.

Consulta los detalles y opciones para borrar datos en [PRIVACY.md](./PRIVACY.md).

## Pruebas

```sh
npm test
npm run build
```

Las pruebas automatizadas no sustituyen la comprobación de los instaladores en Windows/macOS ni una prueba real de conexión con cada proveedor. La configuración fija de modelos puede necesitar actualización si un proveedor cambia su disponibilidad.

## Licencia

Este proyecto se distribuye bajo la licencia [MIT](./LICENSE).

## Preparar una release

Al enviar una etiqueta como `v0.1.0`, el workflow de release comprueba las versiones de la etiqueta, package.json, Cargo.toml y la configuración Tauri, compila Windows y macOS y crea un borrador de GitHub Release con instaladores, ZIP portable de Windows, notas generadas y SHA256SUMS.txt. El borrador debe revisarse y publicarse manualmente. Verifica los hashes con `sha256sum -c SHA256SUMS.txt`.

Estos artefactos no están firmados ni notarizados y el workflow no prueba su instalación. Android sigue siendo una compilación de depuración en el workflow de CI, no un artefacto de release. Antes de publicar: probar instalación y flujo de lectura en Windows y macOS, configurar firma de Windows y firma/notarización de Apple, revisar las notas y comprobar los hashes. El portable necesita WebView2 instalado; si no abre, instala Microsoft Edge WebView2 Runtime desde Microsoft. El instalador Tauri gestiona su requisito de WebView2. No hay actualizaciones automáticas: consulta GitHub Releases para nuevas versiones.
