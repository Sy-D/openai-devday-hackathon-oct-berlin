import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { await page.goto('/planning'); await page.evaluate(() => localStorage.clear()); await page.reload(); });

test('actions are above metrics, identify orders and navigate to a working recovery path', async ({ page }) => {
  const actions = page.getByRole('region', { name: 'Needs action' });
  await expect(actions.locator('article')).toHaveCount(3);
  const actionBounds = await actions.boundingBox();
  const metrics = await page.getByRole('region', { name: 'Network metrics' }).boundingBox();
  expect(actionBounds!.y).toBeLessThan(metrics!.y);
  await expect(page.getByTestId('action-FM-2048')).toContainText('Current delivery is 12h late');
  await page.getByRole('button', { name: 'Compare routes for FM-2041' }).click();
  await expect(page.locator('.plan-panel .order-id')).toHaveText('FM-2041');
  await page.getByTestId('confirm-plan').click();
  await page.getByRole('button', { name: 'Confirm production plan', exact: true }).click();
  await expect(page.getByTestId('action-FM-2041')).toHaveCount(0);
  await expect(actions.locator('article')).toHaveCount(2);
  await page.reload(); await expect(actions.locator('article')).toHaveCount(2);
});

test('confirmed capacity failures and impossible scenarios remain visible with the correct action', async ({ page }) => {
  await page.getByTestId('confirm-plan').click();
  await page.getByRole('button', { name: 'Confirm production plan', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Simulated order quantity' }).fill('42');
  await page.getByRole('button', { name: 'Apply scenario', exact: true }).click();
  await expect(page.getByTestId('action-FM-2048')).toContainText('Confirmed route is infeasible');
  await page.getByRole('spinbutton', { name: 'Simulated order quantity' }).fill('49');
  await page.getByRole('button', { name: 'Apply scenario', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: /^Orders/ }).click();
  await page.getByRole('button', { name: 'Adjust quantity for FM-2048' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Simulated order quantity' })).toHaveValue('49');
  await expect(page.locator('.scenario-anchor')).toBeFocused();
  await expect(page.getByTestId('confirm-plan')).toBeDisabled();
});

test('resolving every order shows the real empty state and reset restores the actions', async ({ page }) => {
  for (const id of ['FM-2048', 'FM-2041', 'FM-2032']) {
    await page.getByRole('button', { name: `Compare routes for ${id}` }).click();
    await page.getByTestId('confirm-plan').click();
    await page.getByRole('button', { name: 'Confirm production plan', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'No actions required' })).toBeVisible();
  await expect(page.locator('.attention-card .metric-value')).toContainText('00');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No actions required' })).toBeVisible();
  await page.getByRole('button', { name: 'Run demo', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Needs action' }).locator('article')).toHaveCount(3);
});

test('mobile first viewport exposes an affected order and a usable next action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole('heading', { name: 'Needs action' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Compare routes for FM-2041' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'outputs/forma-actions-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'outputs/forma-actions-desktop.png' });
});
