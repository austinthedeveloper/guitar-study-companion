import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  API_PATHS,
  CreatePhraseRequest,
  Phrase,
  PhraseSchema,
  PhraseSummary,
  PhraseSummarySchema,
  UpdateHarmonyRequest,
} from '@gsc/contracts';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PhrasesApi {
  private readonly http = inject(HttpClient);

  create(request: CreatePhraseRequest): Observable<Phrase> {
    return this.http
      .post<unknown>(API_PATHS.phrases, request)
      .pipe(map((b) => PhraseSchema.parse(b)));
  }

  get(id: string): Observable<Phrase> {
    return this.http
      .get<unknown>(API_PATHS.phrase(id))
      .pipe(map((b) => PhraseSchema.parse(b)));
  }

  updateHarmony(id: string, request: UpdateHarmonyRequest): Observable<Phrase> {
    return this.http
      .put<unknown>(API_PATHS.phraseHarmony(id), request)
      .pipe(map((b) => PhraseSchema.parse(b)));
  }

  list(): Observable<PhraseSummary[]> {
    return this.http
      .get<unknown>(API_PATHS.phrases)
      .pipe(map((b) => PhraseSummarySchema.array().parse(b)));
  }
}
