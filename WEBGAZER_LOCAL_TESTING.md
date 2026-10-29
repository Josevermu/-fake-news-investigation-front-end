# WebGazer experimental branch

This branch is **not** deployed to production. It loads WebGazer from https://webgazer.cs.brown.edu/webgazer.js when the tester explicitly opts in. WebGazer estimates gaze using webcam video locally.

## Test without backend

1. Checkout `feature/webgazer-eye-tracking-lab`.
2. Run `npm ci`, then `npm start`.
3. Open `http://localhost:4200/eye-tracking-lab`.
4. Click **Start camera**, allow webcam access, ensure the prediction dot moves, and look/click across the page to help calibrate.
5. Answer the four mock questions (DETECCION then MEMORIA). The active question and phase are stored on every gaze sample. Sample rate is capped around 10/sec and 30,000 samples.
6. Export JSON. Verify `samples[]` entries have coordinates, timestamps, elapsedMs and a matching question/phase, and that `answers[]` has four scores.
7. Use **Stop** to release the webcam. Reload to reset test data.

## Real survey test

Use the usual backend-driven NEWS survey locally and opt in using **Activar seguimiento ocular**. Gaze samples begin for the visible question once WebGazer initializes, stop on answer, resume on the next question, and pause on the break/tutorial. The completion page includes **Exportar miradas (JSON)** if gaze samples exist.

## Privacy and limitations

- Camera permission is mandatory. localhost or HTTPS and a supported desktop browser are required.
- No image/video frames or face images are exported; gaze samples remain only in memory until manually downloaded.
- This branch does **not** introduce a backend gaze endpoint or upload eye tracking data.
- Gaze coordinates are **estimates**, not validated fixations or clinical-grade eye tracking. Accuracy requires calibration and testing against known on-screen targets.
- WebGazer currently uses the library site's script URL at runtime. Before a reproducible study, pin and self-host an audited release; do not depend on a mutable third-party script for production.
- Do not test with real research participants before updating study consent and data handling procedures.

## Updated: full survey mock flow

Open `http://localhost:4200/eye-tracking-lab` and click **Abrir cuestionario MOCK (sin API)**. This builds an in-memory `ExperimentSession` with 4 detection and 4 memory questions and routes to `/survey`. It never calls the registration or answer-submission endpoints, and the mock participant ID is used only locally.

On `/survey`, choose **Activar seguimiento ocular** and allow webcam access. The right-hand preview panel shows camera status, while the WebGazer video is positioned alongside it. Continue answering the mock questions. At completion, export the gaze JSON.

Alternatively, remain on the isolated lab route to answer mock questions without camera permission (gaze samples will be empty until the camera is started). Camera access is not required to progress through mock questions.

Desktop browser + localhost is recommended. The WebGazer default video DOM container may differ by library version; if the camera isn't visible, inspect `#webgazerVideoContainer` and `#webgazerVideoFeed`. If camera fails, check devtools console and OS/browser camera permissions.
