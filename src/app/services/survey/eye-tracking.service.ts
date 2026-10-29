import { Injectable, signal } from '@angular/core';

type GazePoint = { x: number; y: number };
type Gazer = {
  begin(): Promise<unknown>; end(): Promise<unknown>;
  pause(): void; resume(): void;
  setGazeListener(callback: (p: GazePoint | null) => void): Gazer;
  saveDataAcrossSessions(enabled: boolean): Gazer;
  showVideo(enabled: boolean): Gazer;
  showPredictionPoints(enabled: boolean): Gazer;
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

  async enable(): Promise<void> {
    if (this.enabled()) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires localhost or HTTPS');
    this.status.set('loading');
    try {
      const api = await this.load();
      this.engine = api;
      api.saveDataAcrossSessions(false);
      api.showVideo(true);
      api.showPredictionPoints(true);
      api.setGazeListener(p => {
        if (!p || !this.active || !this.enabled() || document.hidden) return;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
        const now = performance.now();
        if (now - this.last < 100 || this.samples().length >= 30000) return;
        this.last = now;
        const q = this.active;
        this.samples.update(s => [...s, { questionCode: q.questionCode, phase: q.phase,
          timestamp: new Date().toISOString(), elapsedMs: Math.round(now - q.start),
          x: p.x, y: p.y, width: window.innerWidth, height: window.innerHeight }]);
      });
      await api.begin();
      this.enabled.set(true);
      this.status.set('tracking');
    } catch (e) {
      this.status.set(e instanceof Error ? e.message : 'Eye tracking unavailable');
      throw e;
    }
  }
  questionStart(questionCode: string, phase: string): void {
    if (!this.enabled()) return;
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
  exportJson(): void {
    const data = JSON.stringify({ samples: this.samples(), answers: this.answers(), localOnly: true }, null, 2);
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