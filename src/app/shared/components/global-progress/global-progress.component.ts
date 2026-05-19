import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { ProgressService } from '@services/common/progress.service';

interface ProgressStage {
  route: string;
  percent: number;
  label: string;
}

@Component({
  selector: 'app-global-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global-progress.component.html',
  styleUrl: './global-progress.component.scss',
})
export class GlobalProgressComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly progressService = inject(ProgressService);
  private routerSubscription?: Subscription;

  currentRoute = signal<string>('');
  isTransitioning = signal<boolean>(false);

  private readonly stages: ProgressStage[] = [
    { route: '/survey-tutorial-phase2', percent: 70, label: 'Tutorial Parte 2' },
    { route: '/survey-tutorial', percent: 40, label: 'Tutorial Parte 1' },
    { route: '/survey-break', percent: 65, label: 'Descanso' },
    { route: '/survey', percent: 60, label: 'Encuesta en progreso' },
    { route: '/pre-survey-intro', percent: 20, label: 'Introducción' },
    { route: '/pre-survey', percent: 30, label: 'Cuestionario previo' },
    { route: '/completion', percent: 90, label: 'Retroalimentación' },
    { route: '/reward', percent: 100, label: 'Completado' },
    { route: '/welcome', percent: 10, label: 'Bienvenida' },
    { route: '/', percent: 0, label: 'Bienvenida' },
  ];

  ngOnInit(): void {
    this.currentRoute.set(this.router.url);

    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.isTransitioning.set(true);
        this.currentRoute.set((event as NavigationEnd).urlAfterRedirects);
        setTimeout(() => this.isTransitioning.set(false), 500);
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  shouldShowProgressBar = computed<boolean>(() => {
    const route = this.currentRoute();
    // Show the progress bar on all routes including welcome
    return route !== '';
  });

  progressPercent = computed<number>(() => {
    const route = this.currentRoute();
    
    // Special handling for welcome route - calculate based on step (0-7 → 0-19%)
    if (route === '/welcome' || route === '/') {
      const welcomeStep = this.progressService.getWelcomeStep();
      // 8 steps (0-7) mapped to 0-19%
      return Math.round((welcomeStep / 7) * 19);
    }
    
    // Pre-survey: 20% base + progress within (20-30%)
    if (route.startsWith('/pre-survey') && !route.includes('intro')) {
      const progress = this.progressService.getPreSurveyProgress();
      if (progress.total > 0) {
        // Use (current + 1) to show progress for the current group being answered
        const groupPercent = ((progress.current + 1) / progress.total) * 10;
        return Math.round(20 + groupPercent);
      }
      return 20;
    }
    
    // Survey tutorial: 40% base + progress within (40-50%)
    if (route === '/survey-tutorial') {
      const progress = this.progressService.getSurveyTutorialProgress();
      if (progress.total > 0) {
        const stepPercent = (progress.current / (progress.total - 1)) * 10;
        return Math.round(40 + stepPercent);
      }
      return 40;
    }
    
    // Survey main: 50% base + progress within (50-65%)
    if (route === '/survey') {
      const progress = this.progressService.getSurveyProgress();
      if (progress.total > 0) {
        const questionPercent = (progress.current / progress.total) * 15;
        return Math.round(50 + questionPercent);
      }
      return 50;
    }
    
    // Survey tutorial phase 2: 70% base + progress within (70-80%)
    if (route === '/survey-tutorial-phase2') {
      const progress = this.progressService.getSurveyTutorialPhase2Progress();
      if (progress.total > 0) {
        const stepPercent = (progress.current / (progress.total - 1)) * 10;
        return Math.round(70 + stepPercent);
      }
      return 70;
    }
    
    // Completion: 90% base + progress within (90-95%)
    if (route === '/completion') {
      const progress = this.progressService.getCompletionProgress();
      if (progress.total > 0) {
        const stepPercent = (progress.current / progress.total) * 5;
        return Math.round(90 + stepPercent);
      }
      return 90;
    }
    
    const stage = this.stages.find((s) => route.startsWith(s.route));
    return stage?.percent ?? 0;
  });

  currentStageLabel = computed<string>(() => {
    const route = this.currentRoute();

    if (route === '/welcome' || route === '/') {
      const welcomeStep = this.progressService.getWelcomeStep();
      const labels = [
        'Bienvenida',
        'Consentimiento 1/4',
        'Consentimiento 2/4',
        'Consentimiento 3/4',
        'Consentimiento 4/4',
        'Registro 1/3',
        'Registro 2/3',
        'Registro 3/3',
      ];
      return labels[welcomeStep] ?? 'Bienvenida';
    }

    const stage = this.stages.find((s) => route.startsWith(s.route));
    return stage?.label ?? '';
  });
}
