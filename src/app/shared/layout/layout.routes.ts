import { Routes } from '@angular/router';
import { LayoutComponent } from './layout.component';
import { authGuard } from '@core/guards/auth.guard';

export const LAYOUT_ROUTES: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'welcome',
        pathMatch: 'full',
      },
      {
        path: 'welcome',
        title: 'Bienvenido — Análisis de Información',
        loadComponent: () =>
          import('@pages/welcome/welcome.component').then(
            (c) => c.WelcomeComponent
          ),
      },
      {
        path: 'pre-survey-intro',
        title: 'Inicio del cuestionario — Análisis de Información',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@pages/pre-survey-intro/pre-survey-intro.component').then(
            (c) => c.PreSurveyIntroComponent
          ),
      },
      {
        path: 'pre-survey',
        title: 'Cuestionario previo — Análisis de Información',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@pages/pre-survey/pre-survey.component').then(
            (c) => c.PreSurveyComponent
          ),
      },
      {
        path: 'survey-tutorial',
        title: 'Tutorial del Experimento — Análisis de Información',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@pages/survey-tutorial/survey-tutorial.component').then(
            (c) => c.SurveyTutorialComponent
          ),
      },
      {
        path: 'survey-tutorial-phase2',
        title: 'Tutorial Parte 2 — Análisis de Información',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@pages/survey-tutorial-phase2/survey-tutorial-phase2.component').then(
            (c) => c.SurveyTutorialPhase2Component
          ),
      },
      {
        path: 'survey',
        title: 'Encuesta — Análisis de Información',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@pages/survey/survey.component').then(
            (c) => c.SurveyComponent
          ),
      },
      {
        path: 'survey-break',
        title: 'Descanso — Análisis de Información',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@pages/survey-break/survey-break.component').then(
            (c) => c.SurveyBreakComponent
          ),
      },
      {
        path: 'reward',
        title: 'Recompensa — Análisis de Información',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@pages/reward/reward.component').then(
            (c) => c.RewardComponent
          ),
      },
      {
        path: 'completion',
        title: 'Encuesta Completada',
        canActivate: [authGuard],
        loadComponent: () =>
          import('@pages/completion/completion.component').then(
            (c) => c.CompletionComponent
          ),
      },
    ],
  },
];
