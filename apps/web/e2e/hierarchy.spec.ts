import { test, expect, type Page } from '@playwright/test';

const TEST_USER_EMAIL = process.env.E2E_USER_EMAIL ?? `e2e+${Date.now()}@example.com`;
const TEST_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'changeme-supersecret-123';
const TEST_USER_NAME = process.env.E2E_USER_NAME ?? 'E2E User';
const PROJECT_KEY = process.env.E2E_PROJECT_KEY ?? `T${Date.now().toString().slice(-6)}`;
const PROJECT_NAME = `Hierarchy E2E ${PROJECT_KEY}`;

async function registerOrLogin(page: Page) {
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
  const nameField = page.getByLabel(/name/i);
  if (await nameField.count()) await nameField.fill(TEST_USER_NAME);
  await page.getByRole('button', { name: /register|sign up|create account/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/register'), { timeout: 15_000 }).catch(async () => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15_000 });
  });
}

async function createProject(page: Page) {
  await page.goto('/');
  await page.getByTestId('new-project').click();
  await page.getByTestId('pj-key').fill(PROJECT_KEY);
  await page.getByTestId('pj-name').fill(PROJECT_NAME);
  await page.getByTestId('pj-submit').click();
  const card = page.getByRole('link').filter({ hasText: PROJECT_NAME }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByTestId('breadcrumbs')).toContainText(PROJECT_KEY);
}

async function createWorkItemViaDrawer(
  page: Page,
  opts: { kind: 'epic' | 'feature' | 'story' | 'task'; title: string; parentTitle?: string },
) {
  await page.getByTestId('board-new-item').click();
  await page.getByTestId('item-drawer').waitFor();
  await page.getByTestId('wi-kind').click();
  await page.getByRole('option', { name: kindLabel(opts.kind) }).click();
  await page.getByTestId('wi-title').fill(opts.title);
  if (opts.parentTitle) {
    await page.getByTestId('wi-parent').click();
    await page.getByRole('option', { name: new RegExp(opts.parentTitle, 'i') }).click();
  }
  await page.getByTestId('wi-submit').click();
  await expect(page.getByTestId('item-drawer')).toBeHidden();
  await expect(page.getByText(opts.title, { exact: true }).first()).toBeVisible();
}

function kindLabel(k: 'epic' | 'feature' | 'story' | 'task'): string {
  return { epic: 'Epic', feature: 'Feature', story: 'Story', task: 'Task' }[k];
}

test('Epic → Feature → Story → Task via UI', async ({ page }) => {
  test.setTimeout(120_000);

  await registerOrLogin(page);
  await createProject(page);

  const epic = `Epic ${PROJECT_KEY}`;
  const feature = `Feature ${PROJECT_KEY}`;
  const story = `Story ${PROJECT_KEY}`;
  const task = `Task ${PROJECT_KEY}`;

  await createWorkItemViaDrawer(page, { kind: 'epic', title: epic });
  await createWorkItemViaDrawer(page, { kind: 'feature', title: feature, parentTitle: epic });
  await createWorkItemViaDrawer(page, { kind: 'story', title: story, parentTitle: feature });
  await createWorkItemViaDrawer(page, { kind: 'task', title: task, parentTitle: story });

  await page.getByTestId('tab-tree').click();
  await expect(page.getByTestId('tree-root')).toBeVisible();
  await expect(page.getByTestId('tree-root')).toContainText(epic);
  await expect(page.getByTestId('tree-root')).toContainText(feature);
  await expect(page.getByTestId('tree-root')).toContainText(story);
  await expect(page.getByTestId('tree-root')).toContainText(task);
});
