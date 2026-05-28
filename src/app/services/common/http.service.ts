import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EnvironmentConfigService } from '@services/common/environment-config.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class HttpService {
  private readonly envService = inject(EnvironmentConfigService);
  private readonly httpClient = inject(HttpClient);

  private get baseUrl(): string {
    return this.envService.values.apiBaseUrl;
  }

  public get<T>(endpoint: string, options: any = {}): Observable<T> {
    return this.httpClient.get(`${this.baseUrl}${endpoint}`, options) as any;
  }

  public post<T>(endpoint: string, body: unknown, options: any = {}): Observable<T> {
    return this.httpClient.post(`${this.baseUrl}${endpoint}`, body, options) as any;
  }

  public put<T>(endpoint: string, body: unknown, options: any = {}): Observable<T> {
    return this.httpClient.put(`${this.baseUrl}${endpoint}`, body, options) as any;
  }

  public delete<T>(endpoint: string, options: any = {}): Observable<T> {
    return this.httpClient.delete(`${this.baseUrl}${endpoint}`, options) as any;
  }
}
