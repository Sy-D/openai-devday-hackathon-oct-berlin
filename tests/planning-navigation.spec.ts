import { test, expect } from '@playwright/test';

test('supplier navigation preserves planning decisions without leaking planner styles', async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' && /hydration|did not match|server rendered/i.test(message.text())) hydrationErrors.push(message.text());
  });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const supplierAppearance = () => page.locator('[data-slot="sidebar-inset"]').evaluate(element => {
    const style = getComputedStyle(element);
    return { fontSize: style.fontSize, color: style.color, background: style.backgroundColor, padding: style.padding };
  });
  const before = await supplierAppearance();

  await page.getByRole('link', { name: 'Production planning', exact: true }).click();
  await expect(page).toHaveURL(/\/planning$/);
  await expect(page.getByRole('heading', { name: 'Needs action 3' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Simulated order quantity' }).fill('42');
  await page.getByRole('button', { name: 'Apply scenario', exact: true }).click();
  await page.getByTestId('plan-express').click();
  await page.getByTestId('confirm-plan').click();
  await page.getByRole('button', { name: 'Confirm production plan', exact: true }).click();
  await expect(page.getByText('FM-2048 is back on track')).toBeVisible();

  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('.forma-app')).toHaveCount(0);
  expect(await supplierAppearance()).toEqual(before);

  await page.getByRole('link', { name: 'Production planning', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Simulated order quantity' })).toHaveValue('42');
  await expect(page.getByTestId('plan-express')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('FM-2048 is back on track')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Simulated order quantity' })).toHaveValue('42');
  await expect(page.getByText('FM-2048 is back on track')).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});

test('mobile planning uses the shared navigation and keeps required actions first', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/planning');
  await expect(page.getByRole('heading', { name: /Needs action/ })).toBeVisible();
  const actions = await page.locator('.needs-action').boundingBox();
  const metrics = await page.locator('.metric-grid').boundingBox();
  expect(actions!.y).toBeLessThan(metrics!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
  await page.getByRole('link', { name: 'Production planning', exact: true }).click();
  await expect(page).toHaveURL(/\/planning$/);
  await expect(page.getByRole('heading', { name: /Needs action/ })).toBeVisible();
});
