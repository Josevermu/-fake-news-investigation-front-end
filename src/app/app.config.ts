import {
  provideHttpClient,
  withFetch,
} from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { EnvironmentConfigService } from '@services/common/environment-config.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    provideHttpClient(withFetch()),
    {
      provide: APP_INITIALIZER,
      deps: [EnvironmentConfigService],
      multi: true,
      useFactory: (envService: EnvironmentConfigService) => () =>
        envService.loadConfig(),
    },
  ],
};
