import { Injectable, NgZone, inject, signal } from '@angular/core';

type GazePoint = { x: number; y: number };
type Gazer = {
  begin(): Promise<unknown>; end(): Promise<unknown>;
  pause(): void; resume(): void;
  setGazeListener(callback: (p: GazePoint | null) => void): Gazer;
  saveDataAcrossSessions(enabled: boolean): Gazer;
  showVideo(enabled: boolean): Gazer;
  showPredictionPoints(enabled: boolean): Gazer;
  recordScreenPosition?(x: number, y: number, type: string): unknown;
  getCurrentPrediction?(): GazePoint | null;
  clearGazeListener?(): Gazer;
  showFaceOverlay?(enabled: boolean): Gazer;
};
interface Sample { questionCode: string; phase: string; trialIndex: number; timestamp: string; elapsedMs: number;
  x: number; y: number; width: number; height: number; xNormalized: number; yNormalized: number;
  area: 'news_image' | 'news_text' | 'answer_scale' | 'other' }
interface AnswerEvent { questionCode: string; phase: string; trialIndex: number; timestamp: string; score: number;
  responseTimeMs: number; gazeSamples: number; gazeXAtAnswer: number | null; gazeYAtAnswer: number | null }
@Injectable({ providedIn: 'root' })
export class EyeTrackingService {
  private readonly zone = inject(NgZone);
  private engine?: Gazer;
  private active?: { questionCode: string; phase: string; trialIndex: number; start: number; samplesAtStart: number };
  private last = 0;
  readonly enabled = signal(false);
  readonly status = signal('off');
  readonly samples = signal<Sample[]>([]);
  readonly answers = signal<AnswerEvent[]>([]);
  readonly predictionCount = signal(0);
  readonly lastPoint = signal<GazePoint | null>(null);
  readonly calibrated = signal(false);
  readonly calibrationIndex = signal(0);
  readonly calibrationClicks = signal(0);
  readonly error = signal('');
  readonly stage = signal('idle');
  readonly nullPredictions = signal(0);
  readonly predictionVisible = signal(false);
  readonly lastErrorStack = signal('');
  private readonly libraryUrl = 'https://cdn.jsdelivr.net/npm/webgazer@3.5.3/dist/webgazer.min.js';
  readonly calibrationPositions = [
    [15, 15], [50, 15], [85, 15],
    [15, 50], [50, 50], [85, 50],
    [15, 85], [50, 85], [85, 85]
  ] as const;
  get recording(): boolean { return !!this.active; }
  get activeQuestionCode(): string { return this.active?.questionCode ?? ''; }
  get activeTrialIndex(): number { return this.active?.trialIndex ?? -1; }
  get activeQuestionSamples(): number { return this.active ? this.samples().length - this.active.samplesAtStart : 0; }
  get hasGazeData(): boolean { return this.samples().length > 0; }

  async enable(): Promise<void> {
    if (this.enabled()) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires localhost or HTTPS');
    this.status.set('Iniciando seguimiento ocular...');
    this.stage.set('loading-script');
    this.error.set('');
    this.lastErrorStack.set('');
    try {
      const api = await this.load();
      this.engine = api;
      this.stage.set('configuring');
      if (typeof api.setGazeListener !== 'function' || typeof api.begin !== 'function') {
        throw new Error('La versión de WebGazer no expone begin() o setGazeListener().');
      }
      if (typeof api.saveDataAcrossSessions === 'function') api.saveDataAcrossSessions(false);
      // Configure the listener first; preview DOM may not exist until begin().
      api.setGazeListener(p => {
        this.zone.run(() => this.receivePrediction(p));
      });
      this.stage.set('begin');
      await api.begin();
      this.stage.set('camera-preview');
      if (typeof api.showVideo === 'function') api.showVideo(true);
      if (typeof api.showFaceOverlay === 'function') api.showFaceOverlay(false);
      if (typeof api.showPredictionPoints === 'function') api.showPredictionPoints(false);
      this.enabled.set(true);
      this.stage.set('calibrating');
      this.status.set('Calibrando · 9 puntos');
      this.calibrated.set(false);
      this.calibrationIndex.set(0);
      this.calibrationClicks.set(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.lastErrorStack.set(e instanceof Error ? (e.stack || '') : '');
      console.error('[WebGazer] Falló en etapa ' + this.stage(), e);
      this.status.set('Error en ' + this.stage() + ': ' + msg);
      this.error.set(this.status());
      this.enabled.set(false);
      try { await this.engine?.end(); } catch { /* Cleanup best effort */ }
      this.engine = undefined;
      throw e;
    }
  }

  private receivePrediction(p: GazePoint | null): void {
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          this.nullPredictions.update(n => n + 1);
          this.predictionVisible.set(false);
          return;
        }
        if (document.hidden) return;
        const now = performance.now();
        if (now - this.last < 100 || this.samples().length >= 30000) return;
        this.last = now;
        this.predictionVisible.set(true);
        this.predictionCount.update(n => n + 1);
        this.lastPoint.set({x: p.x, y: p.y});
        const q = this.active;
        if (!q) return;
        const inside = (selector: string): boolean => {
          const el = document.querySelector<HTMLElement>(selector);
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
        };
        const area: Sample['area'] = inside('.question-image') ? 'news_image'
          : inside('.question-text') ? 'news_text'
          : inside('.scale-container') ? 'answer_scale' : 'other';
        const width = Math.max(window.innerWidth, 1);
        const height = Math.max(window.innerHeight, 1);
        this.samples.update(s => [...s, { questionCode: q.questionCode, phase: q.phase,
          trialIndex: q.trialIndex,
          timestamp: new Date().toISOString(), elapsedMs: Math.round(now - q.start),
          x: p.x, y: p.y, width, height, xNormalized: p.x / width,
          yNormalized: p.y / height, area }]);

  }
  calibrate(x: number, y: number): void {
    if (!this.enabled() || this.calibrated()) return;
    this.engine?.recordScreenPosition?.(x, y, 'click');
    const n = this.calibrationClicks() + 1;
    if (n < 3) { this.calibrationClicks.set(n); return; }
    this.calibrationClicks.set(0);
    if (this.calibrationIndex() < 8) { this.calibrationIndex.update(v => v + 1); return; }
    this.calibrated.set(true);
    this.status.set('calibrated');
    this.engine?.pause();
  }
  questionStart(questionCode: string, phase: string, trialIndex = 0): void {
    if (!this.enabled() || !this.calibrated()) return;
    this.active = { questionCode, phase, trialIndex, start: performance.now(), samplesAtStart: this.samples().length };
    this.engine?.resume();
    this.status.set('Grabando mirada en ' + questionCode);
  }
  answer(score: number): void {
    if (!this.active) return;
    const trial = this.active;
    const p = this.lastPoint();
    this.answers.update(a => [...a, { questionCode: trial.questionCode,
      phase: trial.phase, trialIndex: trial.trialIndex,
      timestamp: new Date().toISOString(), score,
      responseTimeMs: Math.round(performance.now() - trial.start),
      gazeSamples: this.samples().length - trial.samplesAtStart,
      gazeXAtAnswer: p?.x ?? null, gazeYAtAnswer: p?.y ?? null }]);
    this.pause();
  }
  pause(): void {
    this.active = undefined;
    this.predictionVisible.set(false);
    this.engine?.pause();
    if (this.enabled() && this.calibrated()) this.status.set('En pausa entre preguntas');
  }
  async stop(): Promise<void> {
    this.pause();
    this.enabled.set(false);
    try { await this.engine?.end(); } catch { /* best effort */ }
    this.engine = undefined;
    this.status.set('off');
  }
  /** Reset only locally collected gaze events; do not touch the research database. */
  clear(): void {
    this.samples.set([]);
    this.answers.set([]);
    this.predictionCount.set(0);
    this.lastPoint.set(null);
    this.nullPredictions.set(0);
    this.predictionVisible.set(false);
    this.error.set('');
  }
  getVideoStream(): MediaStream | null {
    const video = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;
    return video?.srcObject instanceof MediaStream ? video.srcObject : null;
  }
  exportJson(): void {
    if (!this.samples().length) {
      this.error.set('Sin muestras: activa la cámara, completa la calibración y observa el contador de predicciones.');
      return;
    }
    const summary = Object.values(this.samples().reduce((groups, s) => {
      const key = s.phase + ':' + s.questionCode;
      const item = groups[key] ?? { phase: s.phase, questionCode: s.questionCode, count: 0,
        newsImage: 0, newsText: 0, answerScale: 0, other: 0 };
      item.count += 1;
      if (s.area === 'news_image') item.newsImage += 1;
      else if (s.area === 'news_text') item.newsText += 1;
      else if (s.area === 'answer_scale') item.answerScale += 1;
      else item.other += 1;
      groups[key] = item; return groups;
    }, {} as Record<string, {phase: string; questionCode: string; count: number;
      newsImage: number; newsText: number; answerScale: number; other: number}>));
    const data = JSON.stringify({ schemaVersion: 3, library: 'webgazer@3.5.3',
      collectedAt: new Date().toISOString(), samples: this.samples(), answers: this.answers(),
      summary, predictionCount: this.predictionCount(), nullPredictions: this.nullPredictions(),
      localOnly: true }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'survey-gaze-test.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  private load(): Promise<Gazer> {
    const w = window as Window & { webgazer?: Gazer };
    if (w.webgazer) return Promise.resolve(w.webgazer);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this.libraryUrl;
      script.onload = () => w.webgazer ? resolve(w.webgazer) : reject(new Error('WebGazer missing'));
      script.onerror = () => reject(new Error('Could not load WebGazer'));
      document.head.appendChild(script);
    });
  }
}