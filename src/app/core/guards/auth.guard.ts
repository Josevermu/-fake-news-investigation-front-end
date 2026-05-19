import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SurveyService } from '@services/survey/survey.service';

export const authGuard: CanActivateFn = (route, state) => {
  const surveyService = inject(SurveyService);
  const router = inject(Router);

  const session = surveyService.session();
  
  if (!session || !session.participantId) {
    // Redirect to welcome if no session exists
    router.navigate(['/welcome']);
    return false;
  }

  return true;
};
