import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SurveyService } from '@services/survey/survey.service';

/** Allows access only when a registered participant session exists. */
export const authGuard: CanActivateFn = () => {
  const surveyService = inject(SurveyService);
  const router = inject(Router);

  if (!surveyService.session()?.participantId) {
    // Redirect to welcome if no session exists
    router.navigate(['/welcome']);
    return false;
  }

  return true;
};
