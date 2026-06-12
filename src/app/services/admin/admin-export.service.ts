import { HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_ROUTES } from '@constants/api-routes.config';
import { HttpService } from '@services/common/http.service';
import { Observable, catchError, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AdminExportService {
  private readonly http = inject(HttpService);

  downloadCsv(username: string, password: string): Observable<Blob> {
    const credentials = btoa(`${username}:${password}`);
    const headers = new HttpHeaders({
      Authorization: `Basic ${credentials}`,
    });

    return this.http
      .get<Blob>(API_ROUTES.admin.exportCsv, {
        headers,
        responseType: 'blob' as const,
      })
      .pipe(
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }
}
