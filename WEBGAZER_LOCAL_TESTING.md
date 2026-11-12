# WebGazer: local QA instructions

Branch: `feature/webgazer-eye-tracking-lab`. This branch is not deployed to Azure production.

## Test without a backend

1. `npm ci && npm start`.
2. Open `http://localhost:4200/eye-tracking-lab`.
3. Select Grupo A or Grupo B. This creates an in-memory backend-shaped experiment session.
4. Alternatively, open `/welcome` and click **PRUEBA LOCAL: recorrido completo sin backend** to test PROFILE, both tutorials, DETECCION and MEMORIA.
5. On `/survey`, click **Activar seguimiento ocular**. Permit the camera.
6. In the nine-point calibration overlay, look at the yellow point and click it **three times**. Repeat all nine positions. Keep face illuminated and stable.
7. Verify camera video is visible, `predicciones` increases, and `muestras` increases while looking at the question. Gaze values should vary with eye movement.
8. Answer questions and go through the break to MEMORIA. At completion click **Exportar miradas JSON**.
9. Inspect `samples[]`: there should be many coordinate samples per question, with timestamp, elapsedMs, x/y, normalized coordinates and area. `answers[]` contains scores; `summary[]` counts samples per question and area.
10. Export is blocked with a useful diagnostic if there are zero gaze samples; an answer-only JSON is not considered a valid gaze recording.

## Data boundaries

This demo never calls the protected register, submitBatch, or reward API. Webcam frames remain inside WebGazer. Gaze estimates and answers remain in memory until manually downloaded. No persistence endpoint is implemented for eye data. Do not infer true fixations from raw predictions without preprocessing and validation.

## Troubleshooting

- Use desktop Chrome or Edge, localhost or HTTPS, and allow webcam in operating system and browser.
- Confirm the WebGazer script URL is reachable; disable any blocker that prevents that script (only in your controlled test).
- If camera is visible but no predictions appear, check face illumination, position, WebGL availability, and the browser console.
- No camera? Click **Cancelar cámara y continuar sin seguimiento** from the calibration overlay. Questions should remain answerable, but no eye-tracking dataset will exist.
- Refreshing destroys the in-memory experiment session; restart the mock flow.
- WebGazer is a webcam gaze **estimation** library, not a calibrated clinical-grade eye tracker.

WebGazer documentation: https://webgazer.cs.brown.edu/

## Versioned WebGazer and visual validation

The feature branch loads the pinned `webgazer@3.5.3/dist/webgazer.min.js` script rather than an unversioned source. Do a full browser refresh after pulling changes.

While actively answering a NEWS question **after calibration**, a yellow dot should follow estimated gaze position above the content. The camera panel must show all of the following:
- `predicciones` increases whenever the tracker returns valid X/Y estimates
- `Registrando MOCK_D1 ... N muestras de esta pregunta` increases only for the active question
- `Mirada: X ..., Y ...` changes as the estimated gaze changes
- `lecturas nulas` helps distinguish face-tracker failures from export problems
- an error will include the failing startup stage (loading-script, configuring, begin, camera-preview) and an expandable stack trace

Export `schemaVersion: 3` includes `samples[]` with `trialIndex`, phase, question code, timestamp, elapsed milliseconds, X/Y and normalized viewport coordinates, plus the area of interest. `answers[]` includes per-answer response time, sample count and the last predicted X/Y. If no valid gaze samples exist, no JSON is exported.

The original `t is not a function` problem appeared during WebGazer initialization on an unversioned browser-loaded library. The branch now uses an explicit version and reports the failing stage. The Angular CI build does **not** validate webcam inference on a real machine. If you still see the error after pulling, expand `Detalles técnicos del error` and provide the stage/stack.
