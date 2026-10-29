import { CommonModule } from '@angular/common';
import { Component, OnDestroy, signal } from '@angular/core';

type Point = { x: number; y: number };
type Gazer = {
  begin(): Promise<void>;
  end(): Promise<void>;
  pause(): void;
  setGazeListener(callback: (p: Point | null) => void): Gazer;
  saveDataAcrossSessions(b: boolean): Gazer;
  showVideo(b: boolean): Gazer;
  showPredictionPoints(b: boolean): Gazer;
};
type WebGazerWindow = Window & { webgazer?: Gazer };
interface Sample { question: string; phase: string; time: string; elapsedMs: number; x: number; y: number; viewportWidth: number; viewportHeight: number }
@Component({
  selector: 'app-eye-tracking-lab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './eye-tracking-lab.component.html',
  styleUrls: ['./eye-tracking-lab.component.scss'],
})
export class EyeTrackingLabComponent implements OnDestroy {
  readonly questions = [
    { code: 'D1', phase: 'DETECCION', text: 'A headline claims that all online articles have been independently verified. True or false?' },
    { code: 'D2', phase: 'DETECCION', text: 'A fictional headline states that scientists found a new moon. True or false?' },
    { code: 'M1', phase: 'MEMORIA', text: 'Did you see the new-moon headline earlier? Old or new?' },
    { code: 'M2', phase: 'MEMORIA', text: 'Was a headline about underwater cities shown before? Old or new?' },
  ];
  readonly index = signal(0);
  readonly status = signal('Not started');
  readonly samples = signal<Sample[]>([]);
  readonly answers = signal<{ question: string; phase: string; score: number; time: string }[]>([]);
  readonly active = signal(false);
  private gaze?: Gazer;
  private started = 0;
  private lastSample = 0;
  private script?: HTMLScriptElement;
  get question() { return this.questions[this.index()]; }
  async start() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.status.set('Camera requires HTTPS or localhost and a supported browser.');
      return;
    }
    try {
      this.status.set('Loading WebGazer…');
      if (!(window as WebGazerWindow).webgazer) {
        await new Promise<void>((resolve, reject) => {
          this.script = document.createElement('script');
          this.script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
          this.script.onload = () => resolve();
          this.script.onerror = () => reject(new Error('Cannot load WebGazer script'));
          document.head.append(this.script);
        });
      }
      const engine = (window as WebGazerWindow).webgazer;
      if (!engine) throw new Error('WebGazer unavailable');
      this.gaze = engine;
      engine.saveDataAcrossSessions(false);
      engine.showVideo(true);
      engine.showPredictionPoints(true);
      engine.setGazeListener(point => {
        if (!this.active() || !this.question || !point) return;
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
        if (performance.now() - this.lastSample < 100 || this.samples().length >= 30000) return;
        this.lastSample = performance.now();
        this.samples.update(s => [...s, {
          question: this.question.code, phase: this.question.phase,
          time: new Date().toISOString(), elapsedMs: Math.round(performance.now() - this.started),
          x: point.x, y: point.y, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight
        }]);
      });
      await engine.begin();
      this.status.set('Camera running · gaze estimates are local only');
      this.beginQuestion();
    } catch (e) { this.status.set(e instanceof Error ? e.message : 'Camera failed'); await this.stop(); }
  }
  beginQuestion() {
    this.active.set(true);
    this.started = performance.now();
  }
  answer(score: number) {
    if (!this.active() || !this.question) return;
    this.answers.update(a => [...a, { question: this.question.code, phase: this.question.phase, score, time: new Date().toISOString() }]);
    this.active.set(false);
    if (this.index() < this.questions.length - 1) {
      this.index.update(i => i + 1);
      requestAnimationFrame(() => this.beginQuestion());
    } else { this.status.set('Completed · export your results'); this.gaze?.pause(); }
  }
  async stop() {
    this.active.set(false);
    try { await this.gaze?.end(); } catch {}
    this.gaze = undefined;
    this.status.set('Stopped');
  }
  exportData() {
    const data = JSON.stringify({ testOnly: true, samples: this.samples(), answers: this.answers() }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'webgazer-local-test.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  ngOnDestroy() { void this.stop(); }
}