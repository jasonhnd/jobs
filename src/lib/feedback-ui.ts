import {
  KNOWN_OPTIONS,
  MAX_EMAIL_LEN,
  MAX_FREETEXT_LEN,
  MAX_OCCUPATION_ID_LEN,
} from './feedback-helpers.js';

const OPTION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  b2c_career: '自分のキャリア・転職',
  b2c_student: '学生・進路選び',
  b2b_hr: '人事・採用',
  b2b_school: '学校・教育',
  b2b_training: '研修・リスキリング',
  media: 'メディア・取材',
  developer: '開発・API／データ活用',
  methodology: '評価方法について',
  data_quality: 'データ品質について',
  curiosity: '興味・情報収集',
  other: 'その他',
});

export const FEEDBACK_OPTIONS = Object.freeze(
  Array.from(KNOWN_OPTIONS, (key) => Object.freeze({
    key,
    label: OPTION_LABELS[key] ?? key,
  })),
);

export type FeedbackPayload = {
  email: string | null;
  options: string[];
  freetext: string;
  occupation_id: string | null;
  lang: 'ja';
  htmlfield: string;
  'cf-turnstile-response': string;
};

export type FeedbackOutcome = {
  success: boolean;
  errorCode: string;
};

export type FeedbackAnalytics = {
  selected_options: string;
  freetext_length: number;
  has_email: 'true' | 'false';
  language: 'ja';
  success: 'true' | 'false';
  error_reason: string;
};

type FeedbackPayloadInput = {
  selectedOptions: readonly string[];
  freetext: string;
  email?: string;
  htmlfield?: string;
  turnstileToken?: string;
  pathname?: string;
};

/** Extract the occupation context from canonical and legacy occupation URLs. */
export function occupationIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/(?:ja\/)?(?:occupations\/)?(\d{1,16})(?:[-/]|$)/);
  return match?.[1]?.slice(0, MAX_OCCUPATION_ID_LEN) ?? null;
}

/** Build exactly the JSON contract consumed by api/feedback.js. */
export function buildFeedbackPayload(input: FeedbackPayloadInput): FeedbackPayload {
  const options = Array.from(new Set(input.selectedOptions))
    .filter((key) => KNOWN_OPTIONS.has(key));
  const email = (input.email ?? '').trim().slice(0, MAX_EMAIL_LEN);

  return {
    email: email || null,
    options,
    freetext: input.freetext.slice(0, MAX_FREETEXT_LEN),
    occupation_id: occupationIdFromPathname(input.pathname ?? ''),
    lang: 'ja',
    htmlfield: input.htmlfield ?? '',
    'cf-turnstile-response': input.turnstileToken ?? '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Normalize the endpoint's 2xx/4xx/5xx response into one UI state. */
export function feedbackOutcomeForResponse(status: number, body: unknown): FeedbackOutcome {
  if (isRecord(body) && body.ok === true && body.delivered !== false && status >= 200 && status < 300) {
    return { success: true, errorCode: 'none' };
  }

  if (isRecord(body)) {
    if (typeof body.error === 'string' && body.error) {
      return { success: false, errorCode: body.error };
    }
    if (body.delivered === false && typeof body.warn === 'string' && body.warn) {
      return { success: false, errorCode: body.warn };
    }
  }

  return {
    success: false,
    errorCode: status > 0 ? `http_${status}` : 'network_error',
  };
}

const DELIVERY_ERRORS = new Set([
  'config_missing',
  'delivery_failed',
  'feedback_delivery_failed',
]);

/** Japanese live-region copy for every client state and server error family. */
export function feedbackStatusMessage(
  state: 'idle' | 'pending' | 'success' | 'validation-error' | 'error',
  errorCode = '',
): string {
  if (state === 'idle') return '';
  if (state === 'pending') return '送信中です…';
  if (state === 'success') return 'ご意見を送信しました。ご協力ありがとうございます。';
  if (state === 'validation-error' || errorCode === 'empty_feedback') {
    return '項目を1つ以上選ぶか、ご意見をご入力ください。';
  }
  if (errorCode === 'invalid_email') {
    return 'メールアドレスの形式をご確認ください。';
  }
  if (errorCode === 'rate_limited') {
    return '短時間の送信回数が上限に達しました。しばらく待ってから再度お試しください。';
  }
  if (errorCode === 'turnstile_failed') {
    return 'セキュリティ確認に失敗しました。ページを再読み込みして、もう一度お試しください。';
  }
  if (DELIVERY_ERRORS.has(errorCode)) {
    return '送信先への配信に失敗しました。内容は配信されていません。時間をおいて再度お試しください。';
  }
  if (errorCode === 'payload_too_large') {
    return '入力内容が長すぎます。短くしてから再度お試しください。';
  }
  if (errorCode === 'network_error') {
    return '通信に失敗しました。接続をご確認のうえ、もう一度お試しください。';
  }
  return '送信できませんでした。入力内容をご確認のうえ、もう一度お試しください。';
}

/** GA4-safe projection. Deliberately excludes email and free-text values. */
export function buildFeedbackAnalytics(
  payload: FeedbackPayload,
  outcome: FeedbackOutcome,
): FeedbackAnalytics {
  return {
    selected_options: payload.options.join(','),
    freetext_length: payload.freetext.length,
    has_email: payload.email ? 'true' : 'false',
    language: payload.lang,
    success: outcome.success ? 'true' : 'false',
    error_reason: outcome.errorCode,
  };
}
