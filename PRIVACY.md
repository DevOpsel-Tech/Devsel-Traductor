# Privacidad

Última actualización: 2026-11-13.

## Datos que permanecen en el dispositivo

- Los PDF abiertos y la posición de lectura se guardan en el almacenamiento local del WebView.
- La clave del proveedor se mantiene en memoria durante la sesión y se elimina al cambiar de proveedor o cerrar la aplicación. Una clave de Gemini de la configuración antigua se traslada a memoria y se elimina de esa configuración al arrancar. Las copias de seguridad o datos antiguos del perfil pueden conservarla; si se ha expuesto, revócala ante el proveedor. La memoria del proceso y los datos enviados siguen siendo sensibles.
- Puedes eliminar un PDF desde **PDF guardados**. Las traducciones superpuestas no se conservan al cerrar o recargar la aplicación.

Los datos locales pueden permanecer en el dispositivo o en sus copias de seguridad después de cerrar la aplicación. La desinstalación no garantiza la eliminación de todos los datos del perfil del WebView.

## Datos enviados a terceros

La aplicación no tiene un servidor propio para procesar documentos. Cuando hay una clave configurada:

- Para estimar el idioma, envía al proveedor seleccionado una muestra de texto extraída de páginas del PDF.
- Al solicitar una traducción, envía a ese proveedor el texto de la palabra o línea seleccionada.
- La clave se envía al proveedor seleccionado para autorizar esas solicitudes. OpenRouter puede transmitir el texto al proveedor del modelo que seleccione.

Cada proveedor procesa las solicitudes según sus condiciones y políticas. Revisa esas condiciones y evita usar documentos confidenciales o personales si no tienes autorización para enviarlos al proveedor.

## Analítica y contacto

Esta versión no integra analítica ni telemetría.
