import {
  InterpretRequestSchema,
  InterpretResponse,
  MAX_CROP_BYTES,
} from '@gsc/contracts';
import { AiError, AiProvider, interpretTab } from '@gsc/api/ai-core';
import { apiError, HandlerResponse, zodIssues } from './http';
import { sniffImageType } from './image-bytes';

export interface InterpretDeps {
  ai: AiProvider;
  timeoutMs?: number;
  /** Fake-provider scenario; only passed through when E2E_MODE is enabled. */
  scenario?: string;
  log?: (message: string, data?: Record<string, unknown>) => void;
}

const AI_STATUS: Record<AiError['code'], { status: number; message: string }> =
  {
    ai_timeout: {
      status: 504,
      message:
        'Recognition took too long. Try a smaller selection or try again.',
    },
    ai_unavailable: {
      status: 502,
      message:
        'The recognition service is unavailable. Your work is safe; try again shortly.',
    },
    ai_invalid_output: {
      status: 502,
      message:
        'Recognition returned an unusable result. Try again or enter the notes manually.',
    },
  };

export async function interpretImport(
  body: unknown,
  deps: InterpretDeps,
): Promise<HandlerResponse> {
  if (
    !body ||
    typeof body !== 'object' ||
    (body as { consent?: unknown }).consent !== true
  ) {
    return apiError(
      400,
      'consent_required',
      'Confirm that this image may be sent to the AI provider.',
    );
  }
  const parsed = InterpretRequestSchema.safeParse(body);
  if (!parsed.success) {
    const tooBig = parsed.error.issues.some(
      (i) => i.path.join('.') === 'image.dataBase64' && i.code === 'too_big',
    );
    if (tooBig)
      return apiError(
        413,
        'payload_too_large',
        `Image must be under ${MAX_CROP_BYTES / 1024 / 1024} MB.`,
      );
    return apiError(400, 'validation_failed', 'Invalid interpret request.', {
      issues: zodIssues(parsed.error),
    });
  }

  const { image, tuningMidi } = parsed.data;
  const bytes = new Uint8Array(Buffer.from(image.dataBase64, 'base64'));
  if (bytes.length === 0 || bytes.length > MAX_CROP_BYTES) {
    return apiError(
      413,
      'payload_too_large',
      `Image must be under ${MAX_CROP_BYTES / 1024 / 1024} MB.`,
    );
  }
  const actual = sniffImageType(bytes);
  if (actual !== image.mimeType) {
    return apiError(
      415,
      'unsupported_media_type',
      'Image content does not match a JPEG, PNG, or WebP file.',
    );
  }

  try {
    const result = await interpretTab(
      deps.ai,
      { image: bytes, mimeType: actual, tuningMidi, scenario: deps.scenario },
      deps.timeoutMs,
    );
    // Log usage and counts only, never image bytes or recognized content (copyright/privacy).
    deps.log?.('interpret.ok', {
      provider: result.provider,
      model: result.model,
      events: result.draft.events.length,
      rejected: result.rejectedEventCount,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
    });
    const response: InterpretResponse = result;
    return { status: 200, body: response };
  } catch (err) {
    if (err instanceof AiError) {
      deps.log?.('interpret.ai_error', {
        code: err.code,
        provider: deps.ai.name,
      });
      const mapped = AI_STATUS[err.code];
      return apiError(mapped.status, err.code, mapped.message, {
        retryable: true,
      });
    }
    throw err;
  }
}
