import {test,expect,type Page} from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();});
async function apply(page:Page,quantity:number,deadline:number){
  await page.getByRole('spinbutton',{name:'Simulated order quantity'}).fill(String(quantity));
  await page.getByRole('spinbutton',{name:'Simulated delivery deadline'}).fill(String(deadline));
  await page.getByRole('button',{name:'Apply scenario',exact:true}).click();
}
async function confirm(page:Page){
  await page.getByTestId('confirm-plan').click();
  await page.getByRole('button',{name:'Confirm production plan',exact:true}).click();
}

test('quantity change invalidates the old confirmation, recomputes cost and persists a new plan',async({page})=>{
  await confirm(page);
  await apply(page,42,60);
  await expect(page.getByText('FM-2048 needs plan review')).toBeVisible();
  await expect(page.getByTestId('plan-balanced')).toContainText('Unavailable');
  await expect(page.getByTestId('confirm-plan')).toBeDisabled();
  await expect(page.getByTestId('plan-express')).toContainText('Recommended');
  await expect(page.locator('.metric-value').filter({hasText:'1,560'})).toBeVisible();
  await expect(page.locator('.attention-card .metric-value')).toContainText('03');
  await page.getByTestId('plan-express').click();
  await expect(page.getByTestId('plan-express')).toContainText('€13,081');
  await expect(page.getByTestId('plan-express')).toContainText('2d 1h');
  await page.getByRole('button',{name:'Delivery timeline',exact:true}).click();
  await expect(page.locator('.timeline-assembly')).toHaveText('21h');
  await confirm(page);
  await expect(page.getByText('FM-2048 is back on track')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('spinbutton',{name:'Simulated order quantity'})).toHaveValue('42');
  await expect(page.getByTestId('plan-express')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('FM-2048 is back on track')).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'outputs/forma-what-if.png',fullPage:true});
});

test('deadline and capacity changes stay flagged, and demo reset restores original inputs',async({page})=>{
  await confirm(page);await apply(page,12,40);
  await expect(page.getByText(/confirmed Balanced plan misses the current deadline by 9h/)).toBeVisible();
  await expect(page.getByTestId('plan-express')).toContainText('6h buffer');
  await apply(page,12,33);
  await expect(page.getByText(/No feasible route meets this deadline/)).toBeVisible();
  await page.getByTestId('plan-express').click();await page.getByTestId('confirm-plan').click();
  await expect(page.getByRole('button',{name:'Confirm production plan',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Close plan review'}).click();
  await apply(page,49,60);
  await expect(page.getByText(/No route has enough capacity/)).toBeVisible();
  await expect(page.getByTestId('confirm-plan')).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('spinbutton',{name:'Simulated order quantity'})).toHaveValue('49');
  await expect(page.getByText('FM-2048 needs plan review')).toBeVisible();
  await page.getByRole('button',{name:'Run demo',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'Simulated order quantity'})).toHaveValue('12');
  await expect(page.getByRole('spinbutton',{name:'Simulated delivery deadline'})).toHaveValue('60');
  await expect(page.getByTestId('plan-balanced')).toContainText('€3,222');
  await expect(page.locator('.metric-value').filter({hasText:'1,440'})).toBeVisible();
});

test('draft inputs are validated and original inputs can be restored without erasing a confirmation',async({page})=>{
  await confirm(page);
  for(const invalid of ['0','12.5','501','']){
    await page.getByRole('spinbutton',{name:'Simulated order quantity'}).fill(invalid);
    await expect(page.getByRole('button',{name:'Apply scenario',exact:true})).toBeDisabled();
    await expect(page.getByText(/Enter a whole quantity/)).toBeVisible();
  }
  await page.getByRole('spinbutton',{name:'Simulated order quantity'}).fill('20');
  await page.getByRole('spinbutton',{name:'Simulated delivery deadline'}).fill('337');
  await expect(page.getByRole('button',{name:'Apply scenario',exact:true})).toBeDisabled();
  await page.getByRole('spinbutton',{name:'Simulated delivery deadline'}).fill('60');
  await expect(page.getByTestId('plan-balanced')).toContainText('€3,222');
  await page.getByRole('button',{name:'Apply scenario',exact:true}).click();
  await expect(page.getByTestId('plan-balanced')).toContainText('€5,070');
  await expect(page.getByText('FM-2048 needs plan review')).toBeVisible();
  await page.getByRole('button',{name:'Restore original',exact:true}).click();
  await expect(page.getByText('FM-2048 is back on track')).toBeVisible();
});

test('copilot receives the applied scenario, recomputed schedule and current factory queue',async({page})=>{
  await apply(page,42,60);
  await page.getByRole('button',{name:'Simulate disruption'}).click();
  await page.getByRole('button',{name:'Ask copilot',exact:true}).first().click();
  await expect(page.locator('.assistant-order')).toContainText('42 kits');
  const sent=page.waitForRequest(request=>request.url().endsWith('/api/assistant')&&request.method()==='POST');
  await page.getByRole('button',{name:'What is the cheapest way to deliver on time?'}).click();
  const body=(await sent).postDataJSON();
  expect(body.context.order.quantity).toBe(42);expect(body.context.order.dueHours).toBe(60);
  expect(body.context.plans.find((plan:{id:string})=>plan.id==='express').assemblyHours).toBe(21);
  expect(body.context.factories.find((factory:{id:string})=>factory.id==='dresden').queueHours).toBe(32);
  await expect(page.getByText('Deterministic demo response')).toBeVisible();
  await expect(page.getByRole('button',{name:/Review Fastest · €13,081/})).toBeVisible();
});

test('configured health does not claim a live connection until the API returns a validated reply',async({page})=>{
  await page.route('**/api/health',route=>route.fulfill({json:{mode:'live',ready:false,status:'unverified'}}));
  await page.route('**/api/assistant',route=>route.fulfill({json:{mode:'live',reply:'Balanced is the cheapest on-time route.',suggestedPlanId:'balanced'}}));
  await page.getByRole('button',{name:'Ask copilot',exact:true}).first().click();
  await expect(page.getByText('OpenAI configured · connection unverified')).toBeVisible();
  await expect(page.getByText('Connected to OpenAI',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'What is the cheapest way to deliver on time?'}).click();
  await expect(page.getByText('Connected to OpenAI',{exact:true})).toBeVisible();
});

test('unavailable configured provider is labelled as fallback, not connected',async({page})=>{
  await page.route('**/api/health',route=>route.fulfill({json:{mode:'live',ready:false,status:'unavailable'}}));
  await page.getByRole('button',{name:'Ask copilot',exact:true}).first().click();
  await expect(page.getByText('OpenAI unavailable · demo fallback')).toBeVisible();
  await expect(page.getByText('Connected to OpenAI',{exact:true})).toHaveCount(0);
});
