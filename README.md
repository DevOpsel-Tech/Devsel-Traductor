# Traductor PDF

Aplicación de escritorio para leer PDF y traducir una palabra o línea sin modificar el documento original. Está construida con Tauri 2, Vite y PDF.js.

## Descargar para Windows

[Descargar instalador para Windows x64 (.exe)](https://github.com/DevOpsel-Tech/Devsel-Traductor/raw/refs/heads/main/downloads/TraductorPDF-Windows-x64-setup.exe)

[Descargar versión portable para Windows x64 (.zip)](https://github.com/DevOpsel-Tech/Devsel-Traductor/raw/refs/heads/main/downloads/TraductorPDF-Windows-x64-portable.zip)

[Android ARM64: APK de prueba (ZIP)](https://github.com/DevOpsel-Tech/Devsel-Traductor/actions/runs/43459855172/artifacts/14055931954)

Versión de prueba · Windows sin firma digital · Android con firma de depuración

Para la versión portable, extrae el ZIP y ejecuta `traductor-pdf.exe`. Requiere Microsoft Edge WebView2 Runtime. No instala la aplicación ni crea accesos directos.

Las versiones actuales no están firmadas digitalmente. Windows puede mostrar una advertencia de editor desconocido ("Windows protegió tu PC"). Para instalar de todos modos: pulsa **Más información** → **Ejecutar de todas formas**.

Los archivos son una versión de prueba y la instalación todavía no se ha verificado. El flujo de compilación genera artefactos de macOS y Android; macOS se ofrece abajo y Android está disponible como artefacto de CI.

## Descargar para macOS

La versión de prueba para macOS se genera en el flujo de compilación y estará disponible como artefacto de GitHub Actions o en el borrador de release:

1. Ve a [Actions](https://github.com/DevOpsel-Tech/Devsel-Traductor/actions) o [Releases](https://github.com/DevOpsel-Tech/Devsel-Traductor/releases).
2. Descarga el archivo `.dmg`.
3. Ábrelo y arrastra la aplicación a la carpeta Aplicaciones.

> Es una compilación sin firma ni notarización de Apple. macOS puede mostrar una advertencia de desarrollador no identificado. Para abrirla: clic derecho → Abrir → Abrir de todos modos.

## Descargar para Android

La versión de prueba para móviles Android ARM64 está disponible como artefacto de GitHub Actions:

[Descargar Traductor PDF para Android (ZIP con APK de prueba)](https://github.com/DevOpsel-Tech/Devsel-Traductor/actions/runs/43459855172/artifacts/14055931954)

Necesitas iniciar sesión en GitHub para descargar el ZIP. Extrae el archivo y abre el APK en el móvil; Android puede pedir permiso para instalar desde la aplicación de archivos. Este artefacto es temporal y caduca el 11 de febrero de 2027.

> Es una compilación de depuración, firmada con una clave de prueba. Aún no se ha verificado en un móvil ni está firmada para lanzamiento. Su instalación y la traducción requieren pruebas antes de ofrecerla como versión final.

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

Estos artefactos no están firmados ni notarizados y el workflow no prueba su instalación. Android sigue siendo una compilación de depuración en el workflow de CI, no un artefacto de release. Antes de publicar: probar instalación y flujo de lectura en Windows y macOS, configurar firma de Windows y firma/notarización de Apple, revisar las notas y comprobar los hashes. El portable necesita WebView2 instalado; si no abre, instala Microsoft Edge WebView2 Runtime desde Microsoft. El instalador Tauri gestiona su requisito de WebView2. No hay actualizaciones automáticas: consulta GitHub Releases para nuevas versiones.
