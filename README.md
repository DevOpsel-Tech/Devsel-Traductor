# Traductor PDF

Aplicación de escritorio para leer PDF y traducir una palabra o línea sin modificar el documento original. Está construida con Tauri 2, Vite y PDF.js.

## Descargas

**Versión de prueba**

[Windows x64: instalador (.exe)](https://github.com/DevOpsel-Tech/Devsel-Traductor/raw/refs/heads/main/downloads/TraductorPDF-Windows-x64-setup.exe)

[Windows x64: portátil (.zip)](https://github.com/DevOpsel-Tech/Devsel-Traductor/raw/refs/heads/main/downloads/TraductorPDF-Windows-x64-portable.zip)

Windows sin firma digital.

[Android ARM64: instalador (.apk)](https://github.com/DevOpsel-Tech/Devsel-Traductor/releases/download/android-prueba-0.1.0/TraductorPDF-Android-ARM64-prueba.apk)

Android con firma de depuración.

[macOS: descargar desde Actions](https://github.com/DevOpsel-Tech/Devsel-Traductor/actions/workflows/build.yml)

macOS sin firma ni notarización.

La instalación y el funcionamiento aún necesitan validarse en cada plataforma. Windows puede mostrar una advertencia de editor desconocido. En la versión portátil, extrae el ZIP y ejecuta `traductor-pdf.exe`; requiere Microsoft Edge WebView2 Runtime. Android puede pedir permiso para instalar aplicaciones desde la fuente de descarga; el APK aún no se ha verificado en un móvil o emulador. En macOS puede aparecer una advertencia de desarrollador no identificado; consulta **Privacidad y seguridad** en Ajustes del Sistema para permitir la apertura si procede.

Para macOS, abre una ejecución exitosa de `Build applications` de la rama `main` y descarga el artefacto `traductor-macos-latest` al final de la página. GitHub requiere iniciar sesión para descargar artefactos y estos caducan. Extrae el ZIP descargado, abre el archivo `.dmg` que contiene y arrastra la aplicación a Aplicaciones. La compilación usa `macos-latest` y está dirigida a Mac con Apple silicon; no se ofrece aquí una compilación para Intel.

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

GitHub Actions ejecuta las pruebas y prepara compilaciones de Windows, macOS y Android. Los descargables de Windows están en el repositorio y el APK de prueba de Android está publicado en **Releases**.

Los APK de Android son compilaciones de depuración; no hay firma de lanzamiento para Android.

## API y almacenamiento

Elige un proveedor en **Conectar API** e introduce su clave. La clave se guarda en el almacenamiento seguro del sistema operativo (Keychain en macOS, Credential Manager en Windows y el almacén del sistema en Linux) y se reutiliza al abrir la aplicación sin dejarla en texto plano ni en localStorage. Si existe una clave antigua guardada en la configuración local, se migra a memoria y se elimina del almacenamiento anterior al arrancar. Los PDF se guardan en el almacenamiento local del WebView. Para detectar el idioma se envía una muestra de texto al proveedor elegido; al traducir, también se envía el texto seleccionado. OpenRouter puede enviar el texto al proveedor del modelo que seleccione. No introduzcas claves en el código ni en incidencias públicas.

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

Estos artefactos no están firmados ni notarizados y el workflow no prueba su instalación. Android dispone de una publicación de prueba separada con un APK de depuración, no de una versión firmada para lanzamiento. Antes de publicar: probar instalación y flujo de lectura en Windows y macOS, configurar firma de Windows y firma/notarización de Apple, revisar las notas y comprobar los hashes. El portable necesita WebView2 instalado; si no abre, instala Microsoft Edge WebView2 Runtime desde Microsoft. El instalador Tauri gestiona su requisito de WebView2. No hay actualizaciones automáticas: consulta GitHub Releases para nuevas versiones.
