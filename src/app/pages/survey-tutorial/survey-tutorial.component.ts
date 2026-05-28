import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GlassCardComponent } from '@shared/components/glass-card/glass-card.component';
import { ToastComponent } from '@shared/components/toast/toast.component';
import { ProgressService } from '@services/common/progress.service';

@Component({
  selector: 'app-survey-tutorial',
  standalone: true,
  imports: [CommonModule, GlassCardComponent, ToastComponent],
  templateUrl: './survey-tutorial.component.html',
  styleUrl: './survey-tutorial.component.scss',
})
export class SurveyTutorialComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly progressService = inject(ProgressService);

  currentStep = signal(0);
  selectedValue = signal<number | null>(null);
  selectionLocked = signal(false);
  showingFeedback = signal(false);

  readonly scaleValues: number[] = Array.from({ length: 21 }, (_, i) => i - 10);

  readonly steps = [
    {
      icon: '🤠',
      title: '¡Cuestionario completado éxitosamente!',
      description:
        'Ahora te mostraremos cómo funciona la tarea principal. Presta atención a las instrucciones.',
    },
    {
      icon: '📋',
      title: 'Estructura del experimento',
      description:
        'A continuación podrás investigar y detectar que tipos de información es real  y falsa acerca de diferentes temas de interés.',
    },
    {
      icon: '🔢 ⚡',
      title: 'Escala de respuesta y avance automático',
      description:
        'Debajo de cada noticia verás una fila de botones numéricos. Haz clic en el número que mejor represente tu respuesta. Tu elección se guardará automáticamente.',
    },
    {
      icon: '🎯',
      title: 'Ejemplo práctico',
      description:
        'Por favor,  lea  esta  información y emite un juicio sobre la escala,  eligiendo la opción en la escala que consideres oportuna.',
      isExample: true,
    },
    {
      icon: '✅',
      title: '¡Listo para comenzar!',
      description:
        'Recuerda: no hay respuestas correctas o incorrectas. Responde de forma honesta y espontánea. ¡Mucho éxito!',
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
    this.progressService.setSurveyTutorialProgress(this.currentStep(), this.steps.length);
  }

  next(): void {
    if (this.isLast) {
      this.router.navigate(['/survey']);
    } else {
      this.currentStep.update((s) => s + 1);
      this.progressService.setSurveyTutorialProgress(this.currentStep(), this.steps.length);
      // Reset selection when moving to next step
      this.selectedValue.set(null);
      this.selectionLocked.set(false);
      this.showingFeedback.set(false);
    }
  }

  back(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update((s) => s - 1);
      this.progressService.setSurveyTutorialProgress(this.currentStep(), this.steps.length);
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
