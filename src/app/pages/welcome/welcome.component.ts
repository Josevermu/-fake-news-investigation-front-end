import { Component, inject, signal, WritableSignal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GlassCardComponent } from '@shared/components/glass-card/glass-card.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { SurveyService } from '@services/survey/survey.service';
import { ProgressService } from '@services/common/progress.service';
import { ParticipantRequest, Sex } from '@models/survey.interface';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, FormsModule, GlassCardComponent, LoadingComponent],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
})
export class WelcomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly surveyService = inject(SurveyService);
  private readonly progressService = inject(ProgressService);

  readonly sexOptions = [
    { value: Sex.MALE, label: 'Masculino' },
    { value: Sex.FEMALE, label: 'Femenino' },
    { value: Sex.OTHER, label: 'Otro' },
  ];
  /** Current step: 0=welcome, 1-4=consent, 5=registration */
  currentStep: WritableSignal<number> = signal(0);

  /** Form fields. */
  alias = '';
  email = '';
  sex: Sex | null = null;
  age: number | null = null;
  region = '';

  /** Consent checkboxes — step 2 */
  consent2a = false;
  consent2b = false;

  /** Consent checkboxes — step 3 */
  consent3a = false;
  consent3b = false;

  /** Consent checkboxes — step 4 */
  consent4a = false;
  consent4b = false;

  /** Loading & error states. */
  isLoading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string> = signal('');

  /** Show mobile tip only on step 0 and if it's a mobile device */
  showMobileTip = computed(() => {
    if (this.currentStep() !== 0) return false;
    
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      navigator.userAgent.toLowerCase()
    );
    const isSmallScreen = window.innerWidth < 768;
    const isPortrait = window.innerHeight > window.innerWidth;
    
    return isMobile && isSmallScreen && isPortrait;
  });

  ngOnInit(): void {
    // Initialize the progress service with the current step
    this.progressService.setWelcomeStep(this.currentStep());
  }

  nextStep(): void {
    this.errorMessage.set('');
    const step = this.currentStep();

    // Validate checkboxes before advancing
    if (step === 2 && (!this.consent2a || !this.consent2b)) {
      this.errorMessage.set('Debes marcar todas las casillas para continuar.');
      return;
    }
    if (step === 3 && (!this.consent3a || !this.consent3b)) {
      this.errorMessage.set('Debes marcar todas las casillas para continuar.');
      return;
    }
    // Step 4: last checkbox (project info) is optional
    if (step === 4 && !this.consent4a) {
      this.errorMessage.set('Debes marcar la casilla obligatoria para continuar.');
      return;
    }

    this.currentStep.update((s) => s + 1);
    this.progressService.setWelcomeStep(this.currentStep());
  }

  prevStep(): void {
    if (this.currentStep() > 0) {
      this.errorMessage.set('');
      this.currentStep.update((s) => s - 1);
      this.progressService.setWelcomeStep(this.currentStep());
    }
  }

  /** Called when user clicks "NO" on consent — cannot proceed. */
  declineConsent(): void {
    this.errorMessage.set(
      'Es necesario aceptar el consentimiento para participar en el estudio.'
    );
  }

  submitRegistration(): void {
    if (!this.alias || !this.email || !this.sex || !this.age || !this.region) {
      this.errorMessage.set('Por favor, completa todos los campos.');
      return;
    }

    this.errorMessage.set('');
    this.isLoading.set(true);

    const payload: ParticipantRequest = {
      alias: this.alias,
      email: this.email,
      sex: this.sex,
      age: this.age,
      region: this.region,
      consentAcademicPurpose: this.consent2a,
      consentParticipationProcess: this.consent2b,
      consentDataProcessing: this.consent3a,
      consentNoRisk: this.consent3b,
      consentNoPayment: this.consent4a,
      consentProjectInfo: this.consent4b,
    };

    this.surveyService.register(payload).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/pre-survey-intro']);
      },
      error: (err) => {
        this.isLoading.set(false);
        const status = err?.status;
        const backendMsg = err?.error?.message;

        if (status === 409) {
          // BusinessException: email already registered
          this.errorMessage.set('Este correo ya está registrado. Por favor usa otro.');
        } else if (status === 400 && backendMsg) {
          // Validation error from backend
          this.errorMessage.set(`Datos inválidos: ${backendMsg}`);
        } else if (status === 0) {
          // Network / CORS error
          this.errorMessage.set('No se pudo conectar con el servidor. Verifica tu conexión.');
        } else {
          this.errorMessage.set(backendMsg || 'Error al registrarse. Intenta nuevamente.');
        }
      },
    });
  }
}
