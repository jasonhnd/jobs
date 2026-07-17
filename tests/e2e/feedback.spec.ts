import { test, expect, type Page, type Request as PlaywrightRequest } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type CapturedGtag = ['event', string, Record<string, string | number>];

async function installGtagCapture(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as unknown as {
      __feedbackGtagEvents: CapturedGtag[];
      gtag: (...args: CapturedGtag) => void;
    };
    target.__feedbackGtagEvents = [];
    target.gtag = (...args: CapturedGtag) => target.__feedbackGtagEvents.push(args);
  });
}

async function capturedEvents(page: Page): Promise<CapturedGtag[]> {
  return page.evaluate(() => (
    window as unknown as { __feedbackGtagEvents: CapturedGtag[] }
  ).__feedbackGtagEvents);
}

test('feedback form submits the endpoint contract once and emits no PII to GA4', async ({ page }) => {
  let requestCount = 0;
  let capturedRequest: PlaywrightRequest | null = null;
  let releaseResponse: (() => void) | undefined;
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });

  await page.route('**/turnstile/v0/api.js', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '',
  }));
  await page.route('**/api/feedback', async (route) => {
    requestCount += 1;
    capturedRequest = route.request();
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, delivered: true }),
    });
  });

  await page.goto('/ja/156', { waitUntil: 'domcontentloaded' });
  await installGtagCapture(page);
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>('[data-feedback-form]');
    if (!form) throw new Error('feedback form missing');
    if (!document.querySelector('.cf-turnstile')) {
      form.insertAdjacentHTML('beforeend', '<div class="cf-turnstile"></div>');
    }
    const token = document.createElement('input');
    token.type = 'hidden';
    token.name = 'cf-turnstile-response';
    token.value = 'test-turnstile-token';
    form.append(token);
    const target = window as unknown as {
      __turnstileResetCalls: string[];
      turnstile: { reset: (selector: string) => void };
    };
    target.__turnstileResetCalls = [];
    target.turnstile = {
      reset: (selector) => target.__turnstileResetCalls.push(selector),
    };
  });
  await page.locator('[data-feedback-root] summary').click();
  await page.getByLabel('自分のキャリア・転職').check();
  await page.getByLabel('ご意見・改善してほしい点（任意）').fill('private feedback body');
  await page.getByLabel('返信先メールアドレス（任意）').fill('private@example.com');

  const submit = page.locator('[data-feedback-submit]');
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(page.locator('[data-feedback-status]')).toContainText('送信中');
  expect(requestCount).toBe(1);

  releaseResponse?.();
  await expect(page.locator('[data-feedback-status]')).toContainText('ありがとうございます');
  await expect(submit).toBeEnabled();
  expect(requestCount).toBe(1);

  const payload = capturedRequest?.postDataJSON() as Record<string, unknown> | undefined;
  expect(payload).toMatchObject({
    email: 'private@example.com',
    options: ['b2c_career'],
    freetext: 'private feedback body',
    occupation_id: '156',
    lang: 'ja',
    htmlfield: '',
    'cf-turnstile-response': 'test-turnstile-token',
  });

  expect(await page.evaluate(() => (
    window as unknown as { __turnstileResetCalls: string[] }
  ).__turnstileResetCalls)).toEqual(['.cf-turnstile']);

  const events = await capturedEvents(page);
  expect(events).toEqual([['event', 'feedback_submit', {
    selected_options: 'b2c_career',
    freetext_length: 21,
    has_email: 'true',
    language: 'ja',
    success: 'true',
    error_reason: 'none',
  }]]);
  expect(JSON.stringify(events)).not.toContain('private@example.com');
  expect(JSON.stringify(events)).not.toContain('private feedback body');
});

test('feedback form surfaces delivery failure and allows a successful retry', async ({ page }) => {
  let attempt = 0;
  await page.route('**/turnstile/v0/api.js', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '',
  }));
  await page.route('**/api/feedback', async (route) => {
    attempt += 1;
    if (attempt === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'feedback_delivery_failed',
          warn: 'config_missing',
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, delivered: true }),
    });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await installGtagCapture(page);
  await page.locator('[data-feedback-root] summary').click();
  await page.getByLabel('データ品質について').check();

  await page.getByRole('button', { name: 'ご意見を送信' }).click();
  const status = page.locator('[data-feedback-status]');
  await expect(status).toContainText('配信に失敗');
  const retry = page.getByRole('button', { name: 'もう一度送信' });
  await expect(retry).toBeEnabled();

  await retry.click();
  await expect(status).toContainText('ありがとうございます');
  expect(attempt).toBe(2);

  const events = await capturedEvents(page);
  expect(events).toHaveLength(2);
  expect(events[0]?.[2]).toMatchObject({
    success: 'false',
    error_reason: 'feedback_delivery_failed',
  });
  expect(events[1]?.[2]).toMatchObject({ success: 'true', error_reason: 'none' });
});

test('feedback form opens from the keyboard with accessible controls and live status', async ({ page }) => {
  await page.route('**/turnstile/v0/api.js', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '',
  }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const summary = page.locator('[data-feedback-root] summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-feedback-root] details')).toHaveAttribute('open', '');
  await expect(page.getByRole('group', { name: 'このサイトを何に使っていますか？（複数選択可）' })).toBeVisible();
  await expect(page.getByLabel('ご意見・改善してほしい点（任意）')).toBeVisible();
  await expect(page.locator('[data-feedback-status]')).toHaveAttribute('aria-live', 'polite');

  const results = await new AxeBuilder({ page })
    .include('[data-feedback-root]')
    .disableRules(['color-contrast'])
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(blocking).toEqual([]);
});
