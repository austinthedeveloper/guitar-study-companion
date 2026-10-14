import { HttpErrorResponse } from '@angular/common/http';
import { toClientError } from './api-error';

describe('toClientError', () => {
  it('parses API error bodies', () => {
    const err = new HttpErrorResponse({
      status: 504,
      error: {
        error: { code: 'ai_timeout', message: 'Too slow', retryable: true },
      },
    });
    expect(toClientError(err)).toEqual({
      code: 'ai_timeout',
      message: 'Too slow',
      retryable: true,
      issues: [],
      status: 504,
    });
  });

  it('maps status 0 to a network error', () => {
    expect(toClientError(new HttpErrorResponse({ status: 0 })).code).toBe(
      'network',
    );
  });

  it('falls back for unknown errors', () => {
    expect(toClientError(new Error('x'))).toMatchObject({
      code: 'internal',
      retryable: true,
    });
  });
});
