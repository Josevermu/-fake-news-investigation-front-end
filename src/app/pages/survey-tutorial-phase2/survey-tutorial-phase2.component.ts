import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GlassCardComponent } from '@shared/components/glass-card/glass-card.component';
import { ToastComponent } from '@shared/components/toast/toast.component';
import { ProgressService } from '@services/common/progress.service';

@Component({
  selector: 'app-survey-tutorial-phase2',
  standalone: true,
  imports: [CommonModule, GlassCardComponent, ToastComponent],
  templateUrl: './survey-tutorial-phase2.component.html',
  styleUrl: './survey-tutorial-phase2.component.scss',
})
export class SurveyTutorialPhase2Component implements OnInit {
  private readonly router = inject(Router);
  private readonly progressService = inject(ProgressService);

  currentStep = signal(0);
  selectedValue = signal<number | null>(null);
  selectionLocked = signal(false);
  showingFeedback = signal(false);

  readonly scaleValues: number[] = Array.from({ length: 21 }, (_, i) => i - 10);

  readonly steps = [
    {
      icon: '🎯',
      title: '¡Bienvenido de nuevo!',
      description:
        'Ahora verás 8 noticias: algunas las habrás visto antes, otras serán completamente nuevas para ti. Tu tarea: indicar si reconoces o no cada noticia.',
    },
    {
      icon: '🧠',
      title: 'Tu tarea',
      description:
        'Para cada noticia, usa la escala para indicar qué tan seguro estás de si la noticia es NUEVA o VIEJA. Los valores negativos indican que crees que es VIEJA, los positivos que es NUEVA.',
    },
    {
      icon: '🎯',
      title: 'Ejemplo práctico',
      description:
        'Practica con este ejemplo. Evalúa si esta noticia es NUEVA o VIEJA.',
      isExample: true,
    },
    {
      icon: '✅',
      title: '¡Listo para la Parte 2!',
      description:
        '¡Estupendo! Muchas gracias. ¡Ahora comenzamos el trabajo de experto en verificación!',
    },
  ];

  readonly exampleQuestion = {
    text: 'La inteligencia artificial está transformando la forma en que vivimos y trabajamos.',
  };

  get step() {
    return this.steps[this.currentStep()];
  }

  get isLast(): boolean {
    return this.currentStep() === this.steps.length - 1;
  }

  ngOnInit(): void {
    this.progressService.setSurveyTutorialPhase2Progress(this.currentStep(), this.steps.length);
  }

  next(): void {
    if (this.isLast) {
      this.router.navigate(['/survey'], { queryParams: { phase: 'exp2' } });
    } else {
      this.currentStep.update((s) => s + 1);
      this.progressService.setSurveyTutorialPhase2Progress(this.currentStep(), this.steps.length);
      // Reset selection when moving to next step
      this.selectedValue.set(null);
      this.selectionLocked.set(false);
      this.showingFeedback.set(false);
    }
  }

  back(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update((s) => s - 1);
      this.progressService.setSurveyTutorialPhase2Progress(this.currentStep(), this.steps.length);
      // Reset selection when going back
      this.selectedValue.set(null);
      this.selectionLocked.set(false);
      this.showingFeedback.set(false);
    }
  }

  selectScale(value: number): void {
    if (this.selectionLocked()) return;

    this.selectedValue.set(value);
    this.selectionLocked.set(true);
    this.showingFeedback.set(true);

    // Simulate the feedback experience like in the real survey
    setTimeout(() => {
      this.showingFeedback.set(false);
    }, 1500);
  }
}
