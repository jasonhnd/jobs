import { test, expect, type Page, type Request as PlaywrightRequest } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type CapturedGtag = ['event', string, Record<string, string | number>];

async function installGtagCapture(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as unknown as {
      __newsletterGtagEvents: CapturedGtag[];
      gtag: (...args: CapturedGtag) => void;
    };
    target.__newsletterGtagEvents = [];
    target.gtag = (...args: CapturedGtag) => target.__newsletterGtagEvents.push(args);
  });
}

async function capturedEvents(page: Page): Promise<CapturedGtag[]> {
  return page.evaluate(() => (
    window as unknown as { __newsletterGtagEvents: CapturedGtag[] }
  ).__newsletterGtagEvents);
}

test('newsletter submits the secure endpoint contract once and emits no PII to GA4', async ({ page }) => {
  let requestCount = 0;
  let capturedRequest: PlaywrightRequest | null = null;
  let releaseResponse: (() => void) | undefined;
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve; });

  await page.route('**/turnstile/v0/api.js', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '',
  }));
  await page.route('**/api/subscribe', async (route) => {
    requestCount += 1;
    capturedRequest = route.request();
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/ja/156', { waitUntil: 'domcontentloaded' });
  await installGtagCapture(page);
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>('[data-newsletter-form]');
    if (!form) throw new Error('newsletter form missing');
    if (!document.querySelector('#newsletter-turnstile')) {
      form.insertAdjacentHTML('beforeend', '<div id="newsletter-turnstile" class="cf-turnstile"></div>');
    }
    const token = document.createElement('input');
    token.type = 'hidden';
    token.name = 'cf-turnstile-response';
    token.value = 'test-newsletter-turnstile-token';
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

  await page.getByLabel('メールアドレス', { exact: true }).fill('Private+Newsletter@Example.INVALID');
  const submit = page.locator('[data-newsletter-submit]');
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(page.locator('[data-newsletter-status]')).toContainText('登録中');
  expect(requestCount).toBe(1);

  releaseResponse?.();
  await expect(page.locator('[data-newsletter-status]')).toContainText('登録を受け付けました');
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveText('登録済み');
  expect(requestCount).toBe(1);

  const payload = capturedRequest?.postDataJSON() as Record<string, unknown> | undefined;
  expect(payload).toEqual({
    email: 'private+newsletter@example.invalid',
    lang: 'ja',
    occupation_id: '156',
    source: 'header_t1',
    htmlfield: '',
    'cf-turnstile-response': 'test-newsletter-turnstile-token',
  });

  expect(await page.evaluate(() => (
    window as unknown as { __turnstileResetCalls: string[] }
  ).__turnstileResetCalls)).toEqual(['#newsletter-turnstile']);

  const events = await capturedEvents(page);
  expect(events).toEqual([['event', 'email_submit_header', {
    language: 'ja',
    success: 'true',
    error_reason: 'none',
  }]]);
  expect(JSON.stringify(events)).not.toContain('private+newsletter@example.invalid');
});

test('newsletter surfaces delivery failure and allows a successful retry', async ({ page }) => {
  let attempt = 0;
  await page.route('**/api/subscribe', async (route) => {
    attempt += 1;
    if (attempt === 1) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'subscribe_failed' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, alreadySubscribed: true }),
    });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await installGtagCapture(page);
  await page.getByLabel('メールアドレス', { exact: true }).fill('retry@example.invalid');

  await page.getByRole('button', { name: '無料で登録' }).click();
  const status = page.locator('[data-newsletter-status]');
  await expect(status).toContainText('登録は完了していません');
  const retry = page.getByRole('button', { name: 'もう一度登録' });
  await expect(retry).toBeEnabled();

  await retry.click();
  await expect(status).toContainText('登録を受け付けました');
  expect(attempt).toBe(2);

  const events = await capturedEvents(page);
  expect(events).toHaveLength(2);
  expect(events[0]?.[2]).toEqual({
    language: 'ja',
    success: 'false',
    error_reason: 'subscribe_failed',
  });
  expect(events[1]?.[2]).toEqual({
    language: 'ja',
    success: 'true',
    error_reason: 'none',
  });
  expect(JSON.stringify(events)).not.toContain('retry@example.invalid');
});

test('newsletter exposes accessible validation, consent, and status controls', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/api/subscribe', (route) => {
    requestCount += 1;
    return route.abort();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const root = page.locator('[data-newsletter-root]');
  const input = page.getByLabel('メールアドレス', { exact: true });
  await expect(root).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AIと仕事の変化を、月1回だけ' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'プライバシーポリシー' }).first()).toHaveAttribute('href', '/privacy');
  await expect(page.locator('[data-newsletter-status]')).toHaveAttribute('aria-live', 'polite');

  await input.fill('not-an-email');
  await page.getByRole('button', { name: '無料で登録' }).click();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[data-newsletter-status]')).toHaveAttribute('role', 'alert');
  await expect(page.locator('[data-newsletter-status]')).toContainText('形式をご確認');
  await expect(input).toBeFocused();
  expect(requestCount).toBe(0);

  await input.fill('valid@example.invalid');
  await expect(input).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('[data-newsletter-status]')).toBeEmpty();

  const results = await new AxeBuilder({ page })
    .include('[data-newsletter-root]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(blocking).toEqual([]);
});

test('newsletter stays non-submitting when client JavaScript is unavailable', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const form = page.locator('[data-newsletter-form]');
  await expect(form).not.toHaveAttribute('action', /.+/);
  await expect(form).not.toHaveAttribute('method', /.+/);
  await expect(page.getByLabel('メールアドレス', { exact: true })).toBeDisabled();
  await expect(page.locator('[data-newsletter-submit]')).toBeDisabled();
  await expect(page.locator('.newsletter-unavailable')).toContainText('JavaScriptが必要');

  await context.close();
});
