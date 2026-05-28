# Imágenes de preguntas por formato de presentación

Cada participante es asignado a **uno** de tres formatos (`PresentationFormat`):

| Formato     | Carpeta       | Descripción                                  |
|-------------|---------------|----------------------------------------------|
| `INSTAGRAM` | `instagram/`  | Capturas estilo publicación de Instagram      |
| `WHATSAPP`  | `whatsapp/`   | Capturas estilo mensaje de WhatsApp           |
| `TEXT`      | `whatsapp/`   | Solo se muestra una imagen con texto plano de la pregunta |

## Nomenclatura de archivos

Cada archivo debe tener el nombre del `questionCode` de la pregunta en la base de datos:

```
instagram/
  P1.png
  P2.png
  P3.png
  ...
  P17.png

whatsapp/
  P1.png
  P2.png
  P3.png
  ...
  P17.png
```

## Cómo funciona

1. El backend asigna un `presentationFormat` al participante al registrarse.
2. El frontend recibe ese formato en el `ExperimentSessionDto`.
3. Para cada pregunta, el frontend carga la imagen de la carpeta correspondiente:
   - `assets/images/questions/{formato_en_minúsculas}/{questionCode}.png`
4. Si el formato es `TEXT`, se carga una imagen sin redes sociales.

## Notas

- Las imágenes deben ser **PNG** (se puede cambiar la extensión en `survey.service.ts` → `getQuestionImagePath()`).
- Si la imagen no existe para una pregunta, el `<img>` se oculta automáticamente (`onerror`).
- Resolución recomendada: **420px de ancho** para una visualización óptima en la encuesta.
