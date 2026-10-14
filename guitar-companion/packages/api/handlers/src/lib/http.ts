/** Framework-neutral response shape; the Functions shell maps it to HttpResponseInit. */
export interface HandlerResponse<T = unknown> {
  status: number;
  body: T;
}
