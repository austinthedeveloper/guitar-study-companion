/** Relative API paths shared by the Functions host and the web client. */
export const API_PATHS = {
  health: '/api/health',
  interpret: '/api/imports/interpret',
  phrases: '/api/phrases',
  phrase: (id: string) => `/api/phrases/${encodeURIComponent(id)}`,
  phraseExplanation: (id: string) =>
    `/api/phrases/${encodeURIComponent(id)}/explanation`,
  phrasePlans: (id: string) => `/api/phrases/${encodeURIComponent(id)}/plans`,
  phraseLatestPlan: (id: string) =>
    `/api/phrases/${encodeURIComponent(id)}/plans/latest`,
  review: '/api/review',
  planSession: (planId: string) =>
    `/api/plans/${encodeURIComponent(planId)}/session`,
  phraseMeta: (id: string) => `/api/phrases/${encodeURIComponent(id)}/meta`,
  phraseHarmony: (id: string) =>
    `/api/phrases/${encodeURIComponent(id)}/harmony`,
} as const;
