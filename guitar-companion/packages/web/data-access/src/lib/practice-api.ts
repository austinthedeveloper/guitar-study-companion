import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  API_PATHS,
  PlanSettings,
  PracticePlan,
  PracticePlanSchema,
  PracticeSession,
  PracticeSessionSchema,
  PracticeHistoryEntry,
  PracticeHistoryEntrySchema,
  ReviewItem,
  ReviewItemSchema,
  UpdateSessionRequest,
} from '@gsc/contracts';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PracticeApi {
  private readonly http = inject(HttpClient);

  createPlan(
    phraseId: string,
    revision: number,
    settings: PlanSettings,
  ): Observable<PracticePlan> {
    return this.http
      .post<unknown>(API_PATHS.phrasePlans(phraseId), { revision, settings })
      .pipe(map((b) => PracticePlanSchema.parse(b)));
  }

  /** Latest plan for a phrase; errors with not_found when there is none. */
  latestPlan(phraseId: string): Observable<PracticePlan> {
    return this.http
      .get<unknown>(API_PATHS.phraseLatestPlan(phraseId))
      .pipe(map((b) => PracticePlanSchema.parse(b)));
  }

  /** What needs attention next, most urgent first. */
  review(): Observable<ReviewItem[]> {
    return this.http
      .get<unknown>(API_PATHS.review)
      .pipe(map((b) => ReviewItemSchema.array().parse(b)));
  }

  /** Every plan built for a phrase, newest first, with progress. */
  history(phraseId: string): Observable<PracticeHistoryEntry[]> {
    return this.http
      .get<unknown>(API_PATHS.phrasePlans(phraseId))
      .pipe(map((b) => PracticeHistoryEntrySchema.array().parse(b)));
  }

  session(planId: string): Observable<PracticeSession> {
    return this.http
      .get<unknown>(API_PATHS.planSession(planId))
      .pipe(map((b) => PracticeSessionSchema.parse(b)));
  }

  saveSession(
    planId: string,
    update: UpdateSessionRequest,
  ): Observable<PracticeSession> {
    return this.http
      .put<unknown>(API_PATHS.planSession(planId), update)
      .pipe(map((b) => PracticeSessionSchema.parse(b)));
  }
}
