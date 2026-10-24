import { test, expect } from '@playwright/test';
import { orders } from '../src/data/network';

test.beforeEach(async ({ page }) => {
  await page.goto('/planning');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('all required orders can be expanded by keyboard with an exposed disclosure state', async ({ page }) => {
  const extra = orders.find(order => order.state !== 'action')!;
  await page.evaluate(order => {
    localStorage.setItem('forma-demo-v1', JSON.stringify({
      scenarios: { [order.id]: { quantity: order.quantity + 1, dueHours: order.dueHours } },
    }));
  }, extra);
  await page.reload();
  const toggle = page.getByRole('button', { name: 'Show all 4 orders' });
  await expect(page.locator('#needs-action-orders article')).toHaveCount(3);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toHaveAttribute('aria-controls', 'needs-action-orders');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#needs-action-orders article')).toHaveCount(4);
  const collapse = page.getByRole('button', { name: 'Show fewer orders' });
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(page.locator('#needs-action-orders article')).toHaveCount(3);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('action reasons and scenario guidance retain readable small-text contrast', async ({ page }) => {
  const checks = await page.locator([
    '.action-heading p', '.action-order > span', '.order-action p', '.action-live-label',
    '.scenario-heading p', '.scenario-badge', '.scenario-field > span',
    '.scenario-field > div > span', '.scenario-deadline > span', '.scenario-deadline > strong',
    '.scenario-help > span',
  ].join(',')).evaluateAll(elements => {
    const luminance = (color: string) => {
      const values = color.match(/[\d.]+/g)!.slice(0, 3).map(Number)
        .map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
    };
    return elements.map(element => {
      let background: Element | null = element;
      while (background && getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement;
      const foreground = luminance(getComputedStyle(element).color);
      const backdrop = luminance(background ? getComputedStyle(background).backgroundColor : 'rgb(255, 255, 255)');
      return { text: element.textContent, ratio: (Math.max(foreground, backdrop) + .05) / (Math.min(foreground, backdrop) + .05) };
    });
  });
  expect(checks.length).toBeGreaterThan(10);
  for (const check of checks) expect(check.ratio, check.text ?? 'Visible guidance').toBeGreaterThanOrEqual(4.5);
});
