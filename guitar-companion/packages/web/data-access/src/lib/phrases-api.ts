import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  API_PATHS,
  CreatePhraseRequest,
  Phrase,
  PhraseSchema,
  PhraseSummary,
  PhraseSummarySchema,
  PhraseQuery,
  UpdateHarmonyRequest,
  UpdatePhraseMetaRequest,
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

  explain(id: string, revision: number): Observable<Phrase> {
    return this.http
      .post<unknown>(API_PATHS.phraseExplanation(id), { revision })
      .pipe(map((b) => PhraseSchema.parse(b)));
  }

  updateHarmony(id: string, request: UpdateHarmonyRequest): Observable<Phrase> {
    return this.http
      .put<unknown>(API_PATHS.phraseHarmony(id), request)
      .pipe(map((b) => PhraseSchema.parse(b)));
  }

  /** The library, optionally filtered (see PhraseQuery). */
  list(query: PhraseQuery = {}): Observable<PhraseSummary[]> {
    const params = Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== ''),
    ) as Record<string, string>;
    return this.http
      .get<unknown>(API_PATHS.phrases, { params })
      .pipe(map((b) => PhraseSummarySchema.array().parse(b)));
  }

  /** Deletes the phrase with its practice plans and sessions. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(API_PATHS.phrase(id));
  }

  updateMeta(id: string, meta: UpdatePhraseMetaRequest): Observable<Phrase> {
    return this.http
      .patch<unknown>(API_PATHS.phraseMeta(id), meta)
      .pipe(map((b) => PhraseSchema.parse(b)));
  }
}
