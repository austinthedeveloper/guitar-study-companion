import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  API_PATHS,
  HealthResponse,
  HealthResponseSchema,
} from '@gsc/contracts';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HealthApi {
  private readonly http = inject(HttpClient);

  getHealth(): Observable<HealthResponse> {
    return this.http
      .get<unknown>(API_PATHS.health)
      .pipe(map((body) => HealthResponseSchema.parse(body)));
  }
}
