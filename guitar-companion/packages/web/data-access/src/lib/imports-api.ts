import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  API_PATHS,
  InterpretRequest,
  InterpretResponse,
  InterpretResponseSchema,
} from '@gsc/contracts';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ImportsApi {
  private readonly http = inject(HttpClient);

  interpret(request: InterpretRequest): Observable<InterpretResponse> {
    return this.http
      .post<unknown>(API_PATHS.interpret, request)
      .pipe(map((body) => InterpretResponseSchema.parse(body)));
  }
}
