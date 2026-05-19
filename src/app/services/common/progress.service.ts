import { Injectable, signal, WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  // Welcome has 8 steps (0-7), we'll map them to progress percentages
  welcomeCurrentStep: WritableSignal<number> = signal(0);
  
  // Pre-survey progress (groups)
  preSurveyCurrentGroup: WritableSignal<number> = signal(0);
  preSurveyTotalGroups: WritableSignal<number> = signal(1);
  
  // Survey tutorial progress
  surveyTutorialCurrentStep: WritableSignal<number> = signal(0);
  surveyTutorialTotalSteps: WritableSignal<number> = signal(1);
  
  // Survey progress (questions)
  surveyCurrentQuestion: WritableSignal<number> = signal(0);
  surveyTotalQuestions: WritableSignal<number> = signal(1);
  
  // Survey tutorial phase 2 progress
  surveyTutorialPhase2CurrentStep: WritableSignal<number> = signal(0);
  surveyTutorialPhase2TotalSteps: WritableSignal<number> = signal(1);
  
  // Completion progress
  completionCurrentStep: WritableSignal<number> = signal(0);
  completionTotalSteps: WritableSignal<number> = signal(1);
  
  setWelcomeStep(step: number): void {
    this.welcomeCurrentStep.set(step);
  }
  
  getWelcomeStep(): number {
    return this.welcomeCurrentStep();
  }
  
  setPreSurveyProgress(currentGroup: number, totalGroups: number): void {
    this.preSurveyCurrentGroup.set(currentGroup);
    this.preSurveyTotalGroups.set(totalGroups);
  }
  
  getPreSurveyProgress(): { current: number; total: number } {
    return {
      current: this.preSurveyCurrentGroup(),
      total: this.preSurveyTotalGroups()
    };
  }
  
  setSurveyTutorialProgress(currentStep: number, totalSteps: number): void {
    this.surveyTutorialCurrentStep.set(currentStep);
    this.surveyTutorialTotalSteps.set(totalSteps);
  }
  
  getSurveyTutorialProgress(): { current: number; total: number } {
    return {
      current: this.surveyTutorialCurrentStep(),
      total: this.surveyTutorialTotalSteps()
    };
  }
  
  setSurveyProgress(currentQuestion: number, totalQuestions: number): void {
    this.surveyCurrentQuestion.set(currentQuestion);
    this.surveyTotalQuestions.set(totalQuestions);
  }
  
  getSurveyProgress(): { current: number; total: number } {
    return {
      current: this.surveyCurrentQuestion(),
      total: this.surveyTotalQuestions()
    };
  }
  
  setSurveyTutorialPhase2Progress(currentStep: number, totalSteps: number): void {
    this.surveyTutorialPhase2CurrentStep.set(currentStep);
    this.surveyTutorialPhase2TotalSteps.set(totalSteps);
  }
  
  getSurveyTutorialPhase2Progress(): { current: number; total: number } {
    return {
      current: this.surveyTutorialPhase2CurrentStep(),
      total: this.surveyTutorialPhase2TotalSteps()
    };
  }
  
  setCompletionProgress(currentStep: number, totalSteps: number): void {
    this.completionCurrentStep.set(currentStep);
    this.completionTotalSteps.set(totalSteps);
  }
  
  getCompletionProgress(): { current: number; total: number } {
    return {
      current: this.completionCurrentStep(),
      total: this.completionTotalSteps()
    };
  }
  
  reset(): void {
    this.welcomeCurrentStep.set(0);
    this.preSurveyCurrentGroup.set(0);
    this.surveyTutorialCurrentStep.set(0);
    this.surveyCurrentQuestion.set(0);
    this.surveyTutorialPhase2CurrentStep.set(0);
    this.completionCurrentStep.set(0);
  }
}
