import { Injectable } from '@angular/core';
import { AppEnvironmentConfig } from '@models/app-environment-config.interface';

/**
 * Service to load and access runtime environment configuration.
 * Configuration must be loaded via APP_INITIALIZER before app starts.
 */
@Injectable({
  providedIn: 'root',
})
export class EnvironmentConfigService {
  private config: AppEnvironmentConfig | null = null;
  public readonly values: AppEnvironmentConfig;

  constructor() {
    this.values = new Proxy({} as AppEnvironmentConfig, {
      get: <K extends keyof AppEnvironmentConfig>(
        _: AppEnvironmentConfig,
        prop: K
      ): AppEnvironmentConfig[K] => {
        if (!this.config) {
          throw new Error(
            `Config property "${String(prop)}" accessed before loading. ` +
              `Check APP_INITIALIZER setup.`
          );
        }
        return this.config[prop];
      },
    });
  }

  /**
   * Loads runtime configuration from JSON file.
   * Must be called during APP_INITIALIZER.
   * Falls back to default dev config if the file can't be loaded.
   */
  async loadConfig(): Promise<void> {
    const fallback: AppEnvironmentConfig = {
      apiBaseUrl: 'https://konradquiz-backend-prod.thankfulground-5d8aa353.eastus2.azurecontainerapps.io/api/v1',
      production: true,
    };

    try {
      const response = await fetch('./assets/config/environment.json');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.config = await response.json();
      console.log('✅ Runtime configuration loaded successfully');
    } catch (error) {
      console.warn('⚠️ Could not load environment.json — using default config', error);
      this.config = fallback;
    }
  }

  getValue<K extends keyof AppEnvironmentConfig>(
    key: K
  ): AppEnvironmentConfig[K] {
    if (!this.config) {
      throw new Error(
        'Attempted to access configuration before it was loaded.'
      );
    }
    return this.config[key];
  }
}
