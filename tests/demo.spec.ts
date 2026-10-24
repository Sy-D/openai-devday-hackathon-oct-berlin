import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/planning');await page.evaluate(()=>localStorage.clear());await page.reload();});

test('urgent order can be recovered, persisted, disrupted and recovered again',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await expect(page.getByRole('heading',{name:'Every part. A clearer path.'})).toBeVisible();
  await expect(page.getByTestId('plan-balanced')).toContainText('11h buffer');
  await page.getByTestId('plan-express').click();
  await expect(page.getByTestId('plan-express')).toHaveAttribute('aria-pressed','true');
  await page.getByTestId('plan-balanced').click();
  await page.getByTestId('confirm-plan').click();
  await expect(page.getByRole('dialog',{name:'A better path for FM-2048.'})).toContainText('€3,222');
  await page.getByRole('button',{name:'Confirm production plan',exact:true}).click();
  await expect(page.getByText('FM-2048 is back on track')).toBeVisible();
  await expect(page.locator('.attention-card .metric-value')).toContainText('02');
  await expect(page.locator('.metric-value').filter({hasText:'91.7'})).toBeVisible();
  await page.reload();await expect(page.getByText('FM-2048 is back on track')).toBeVisible();
  await page.getByRole('button',{name:'Simulate disruption'}).click();
  await expect(page.getByTestId('plan-balanced')).toContainText('13h late');
  await expect(page.locator('.attention-card .metric-value')).toContainText('03');
  await page.getByTestId('plan-express').click();
  await page.getByTestId('confirm-plan').click();await page.getByRole('button',{name:'Confirm production plan',exact:true}).click();
  await expect(page.getByText('FM-2048 is back on track')).toBeVisible();
  await page.getByRole('button',{name:'Activity',exact:true}).click();
  await expect(page.getByText('FM-2048 · Fastest plan confirmed')).toBeVisible();
  expect(errors).toEqual([]);
});

test('late plan needs explicit acknowledgement and keeps the order flagged',async({page})=>{
  await page.getByTestId('plan-economy').click();await page.getByTestId('confirm-plan').click();
  await expect(page.getByRole('button',{name:'Confirm production plan',exact:true})).toBeDisabled();
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Confirm production plan',exact:true}).click();
  await expect(page.locator('.attention-card .metric-value')).toContainText('03');
});

test('copilot uses the running API and suggestion requires separate confirmation',async({page})=>{
  await page.getByRole('button',{name:'Ask copilot',exact:true}).first().click();
  await expect(page.getByText('Demo assistant · no API key configured')).toBeVisible();
  await page.getByRole('button',{name:'Which plan gets this order there fastest?'}).click();
  await expect(page.getByText('Deterministic demo response')).toBeVisible();
  await page.getByRole('button',{name:/Review Fastest/}).click();
  await page.getByRole('button',{name:'Close copilot'}).click();
  await expect(page.getByTestId('plan-express')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.attention-card .metric-value')).toContainText('03');
});

test('search, factory capability inspection, timeline and mobile layout work',async({page})=>{
  await page.getByRole('button',{name:'Inspect Atelier 3D, Lyon'}).click();
  await expect(page.getByText('No compatible parts in this order')).toBeVisible();
  await page.getByRole('button',{name:'Close facility details'}).click();
  await page.getByRole('button',{name:'Delivery timeline',exact:true}).click();
  await expect(page.getByText('Assembly begins only when every component has arrived.')).toBeVisible();
  await page.getByRole('textbox',{name:'Search orders'}).fill('does-not-exist');
  await expect(page.getByRole('heading',{name:'No matching orders'})).toBeVisible();
  await page.getByRole('button',{name:'Clear filters'}).click();
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByTestId('confirm-plan')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  expect(overflow).toBe(false);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'outputs/forma-mobile.png',fullPage:true});
});

test('capture desktop demo',async({page})=>{
  await expect(page.getByTestId('plan-balanced')).toBeVisible();
  await page.screenshot({path:'outputs/forma-dashboard.png',fullPage:true});
});
