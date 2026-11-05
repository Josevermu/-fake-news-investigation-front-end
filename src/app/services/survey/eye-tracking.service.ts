import { Injectable, signal } from '@angular/core';

type GazePoint = { x: number; y: number };
type Gazer = {
  begin(): Promise<unknown>; end(): Promise<unknown>;
  pause(): void; resume(): void;
  setGazeListener(callback: (p: GazePoint | null) => void): Gazer;
  saveDataAcrossSessions(enabled: boolean): Gazer;
  showVideo(enabled: boolean): Gazer;
  showPredictionPoints(enabled: boolean): Gazer;
  recordScreenPosition?(x: number, y: number, type: string): unknown;
};
interface Sample { questionCode: string; phase: string; timestamp: string; elapsedMs: number; x: number; y: number; width: number; height: number }
interface AnswerEvent { questionCode: string; phase: string; timestamp: string; score: number }
@Injectable({ providedIn: 'root' })
export class EyeTrackingService {
  private engine?: Gazer;
  private active?: { questionCode: string; phase: string; start: number };
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
  readonly calibrationPositions = [
    [15, 15], [50, 15], [85, 15],
    [15, 50], [50, 50], [85, 50],
    [15, 85], [50, 85], [85, 85]
  ] as const;
  get recording(): boolean { return !!this.active; }
  get hasGazeData(): boolean { return this.samples().length > 0; }

  async enable(): Promise<void> {
    if (this.enabled()) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires localhost or HTTPS');
    this.status.set('loading');
    this.error.set('');
    try {
      const api = await this.load();
      this.engine = api;
      api.saveDataAcrossSessions(false);
      api.showVideo(true);
      api.showPredictionPoints(true);
      api.setGazeListener(p => {
        if (!p || !this.enabled() || document.hidden) return;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        const now = performance.now();
        if (now - this.last < 100 || this.samples().length >= 30000) return;
        this.last = now;
        this.predictionCount.update(n => n + 1);
        this.lastPoint.set({x: p.x, y: p.y});
        const q = this.active;
        if (!q) return;
        this.samples.update(s => [...s, { questionCode: q.questionCode, phase: q.phase,
          timestamp: new Date().toISOString(), elapsedMs: Math.round(now - q.start),
          x: p.x, y: p.y, width: window.innerWidth, height: window.innerHeight }]);
      });
      await api.begin();
      this.enabled.set(true);
      this.status.set('calibrating');
      this.calibrated.set(false);
      this.calibrationIndex.set(0);
      this.calibrationClicks.set(0);
    } catch (e) {
      this.status.set(e instanceof Error ? e.message : 'Eye tracking unavailable');
      this.error.set(this.status());
      throw e;
    }
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
  questionStart(questionCode: string, phase: string): void {
    if (!this.enabled() || !this.calibrated()) return;
    this.active = { questionCode, phase, start: performance.now() };
    this.engine?.resume();
  }
  answer(score: number): void {
    if (!this.active) return;
    this.answers.update(a => [...a, { questionCode: this.active!.questionCode,
      phase: this.active!.phase, timestamp: new Date().toISOString(), score }]);
    this.pause();
  }
  pause(): void { this.active = undefined; this.engine?.pause(); }
  async stop(): Promise<void> {
    this.pause();
    this.enabled.set(false);
    try { await this.engine?.end(); } catch { /* best effort */ }
    this.engine = undefined;
    this.status.set('off');
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
      const item = groups[key] ?? { phase: s.phase, questionCode: s.questionCode, count: 0 };
      item.count += 1; groups[key] = item; return groups;
    }, {} as Record<string, {phase: string; questionCode: string; count: number}>));
    const data = JSON.stringify({ schemaVersion: 2, samples: this.samples(), answers: this.answers(),
      summary, predictionCount: this.predictionCount(), localOnly: true }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'survey-gaze-test.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  private load(): Promise<Gazer> {
    const w = window as Window & { webgazer?: Gazer };
    if (w.webgazer) return Promise.resolve(w.webgazer);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
      script.onload = () => w.webgazer ? resolve(w.webgazer) : reject(new Error('WebGazer missing'));
      script.onerror = () => reject(new Error('Could not load WebGazer'));
      document.head.appendChild(script);
    });
  }
}