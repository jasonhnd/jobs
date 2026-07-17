import {
  EMAIL_RE,
  MAX_EMAIL_LEN,
  MAX_OCCUPATION_ID_LEN,
} from './subscribe-helpers.js';

/**
 * Historical API attribution retained for the generic T1 signup card.
 * The GA4 event is likewise named `email_submit_header`, even though the
 * restored shared card is rendered at the bottom of every page.
 */
export const NEWSLETTER_SOURCE = 'header_t1' as const;
export const MAX_TURNSTILE_TOKEN_LEN = 2048;
const GA4_PARAMETER_VALUE_MAX = 100;

export type NewsletterPayload = {
  email: string;
  lang: 'ja';
  occupation_id: string;
  source: typeof NEWSLETTER_SOURCE;
  htmlfield: string;
  'cf-turnstile-response': string;
};

export type NewsletterOutcome = {
  success: boolean;
  errorCode: string;
};

export type NewsletterAnalytics = {
  language: 'ja';
  success: 'true' | 'false';
  error_reason: string;
};

type NewsletterPayloadInput = {
  email: string;
  htmlfield?: string;
  turnstileToken?: string;
  pathname?: string;
};

export type NewsletterState =
  | 'idle'
  | 'pending'
  | 'success'
  | 'validation-error'
  | 'error';

/** Extract optional occupation context from canonical and legacy routes. */
export function newsletterOccupationIdFromPathname(pathname: string): string {
  const match = pathname.match(/^\/(?:ja\/)?(?:occupations\/)?(\d{1,16})(?:[-/]|$)/);
  return match?.[1]?.slice(0, MAX_OCCUPATION_ID_LEN) ?? '';
}

/** Client validation mirrors the endpoint's exported email contract. */
export function isValidNewsletterEmail(value: string): boolean {
  const email = value.trim();
  return email.length > 0 && email.length <= MAX_EMAIL_LEN && EMAIL_RE.test(email);
}

/** Build exactly the JSON contract consumed by `/api/subscribe`. */
export function buildNewsletterPayload(input: NewsletterPayloadInput): NewsletterPayload {
  return {
    email: input.email.trim().toLowerCase().slice(0, MAX_EMAIL_LEN),
    lang: 'ja',
    occupation_id: newsletterOccupationIdFromPathname(input.pathname ?? ''),
    source: NEWSLETTER_SOURCE,
    htmlfield: input.htmlfield ?? '',
    'cf-turnstile-response': (input.turnstileToken ?? '').slice(0, MAX_TURNSTILE_TOKEN_LEN),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Normalize the endpoint's response into a stable UI outcome. */
export function newsletterOutcomeForResponse(status: number, body: unknown): NewsletterOutcome {
  if (status >= 200 && status < 300 && isRecord(body) && body.ok === true) {
    return { success: true, errorCode: 'none' };
  }

  if (isRecord(body) && typeof body.error === 'string' && body.error) {
    return { success: false, errorCode: body.error };
  }

  return {
    success: false,
    errorCode: status > 0 ? `http_${status}` : 'network_error',
  };
}

const DELIVERY_ERRORS = new Set([
  'config_missing',
  'server_error',
  'subscribe_failed',
  'http_500',
  'http_502',
  'http_503',
]);

/** Japanese live-region copy for every required client/server state. */
export function newsletterStatusMessage(state: NewsletterState, errorCode = ''): string {
  if (state === 'idle') return '';
  if (state === 'pending') return '登録中です…';
  if (state === 'success') return '登録を受け付けました。次回の月次レポートをお待ちください。';
  if (state === 'validation-error' || errorCode === 'invalid_email') {
    return 'メールアドレスの形式をご確認ください。';
  }
  if (errorCode === 'rate_limited') {
    return '短時間の登録回数が上限に達しました。しばらく待ってから再度お試しください。';
  }
  if (errorCode === 'turnstile_failed') {
    return 'セキュリティ確認に失敗しました。ページを再読み込みして、もう一度お試しください。';
  }
  if (DELIVERY_ERRORS.has(errorCode)) {
    return '登録先への送信に失敗しました。登録は完了していません。時間をおいて再度お試しください。';
  }
  if (errorCode === 'network_error') {
    return '通信に失敗しました。接続をご確認のうえ、もう一度お試しください。';
  }
  return '登録できませんでした。入力内容をご確認のうえ、もう一度お試しください。';
}

/** GA4-safe projection: its input and output cannot contain the email value. */
export function buildNewsletterAnalytics(outcome: NewsletterOutcome): NewsletterAnalytics {
  return {
    language: 'ja',
    success: outcome.success ? 'true' : 'false',
    error_reason: outcome.errorCode.slice(0, GA4_PARAMETER_VALUE_MAX),
  };
}
