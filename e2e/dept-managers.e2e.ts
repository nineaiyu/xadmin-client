import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  clickPanelAction,
  login,
  openEntityPanel,
  openMenuPath
} from "./helpers";

/**
 * 部门级自治：部门管理员任命闭环与「我的管辖」页。
 *
 * 共享库幂等：UI 断言只锚定本用例建立的确定性状态，用例前后经 API 清理
 * （assign-managers 为增量幂等端点），双浏览器第二段与后续用例互不影响。
 */
const DEPT_NAME = "E2E-主管测试部";
const MANAGER_USERNAME = "xadmin";

/** 目标部门主键（E2E 种子部门） */
async function deptPk(page: Page): Promise<string> {
  const res = await page.request.get("/api/identity/dept?page=1&size=1000");
  const body = await res.json();
  const row = (body.data?.results ?? []).find(
    (item: { name: string }) => item.name === DEPT_NAME
  );
  expect(row, `E2E 种子部门 ${DEPT_NAME} 应存在`).toBeTruthy();
  return row.pk;
}

/** 候选用户主键（复用部门候选端点：≤20 条、仅 pk/用户名/昵称） */
async function managerPk(
  page: Page,
  keyword = MANAGER_USERNAME
): Promise<number> {
  const res = await page.request.get(
    `/api/identity/dept/user-options?keyword=${keyword}`
  );
  const body = await res.json();
  expect(body.data?.length).toBeGreaterThan(0);
  return body.data[0].pk;
}

/** 任命/解任（增量幂等） */
async function assign(
  page: Page,
  pk: string,
  payload: { add?: number[]; remove?: number[] }
) {
  const res = await page.request.post(
    `/api/identity/dept/${pk}/assign-managers`,
    { data: payload }
  );
  expect(res.ok()).toBeTruthy();
}

/**
 * 打开行内「部门管理员」任命弹窗：入口已收敛进「管理」抽屉
 * （先开抽屉再点 assignManagers 动作，抽屉会先收起再弹弹窗）。
 */
async function openManagerDialog(page: Page, row: Locator) {
  const drawer = await openEntityPanel(page, row);
  await clickPanelAction(drawer, "assignManagers");
}

test("部门管理员任命与回收（UI 闭环）", async ({ page }) => {
  await login(page);
  const pk = await deptPk(page);
  const userPk = await managerPk(page);
  // 初始态清理：保证「添加」分支可执行（幂等，双浏览器第二段同样成立）
  await assign(page, pk, { remove: [userPk] });

  await openMenuPath(page, ["系统管理"], "/system/dept/index");
  const row = page
    .locator(".el-table__row")
    .filter({ hasText: DEPT_NAME })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  await openManagerDialog(page, row);
  const dialog = page.locator(".el-dialog:visible").last();
  await expect(dialog.getByText(`部门管理员：${DEPT_NAME}`)).toBeVisible();

  // 远程搜索并选中管理员（点击 option 选中；选中后下拉保持打开并拦截后续点击，
  // 属 EP 已知行为，随后点弹窗标题区收起——与 system-pages 岗位成员用例同口径）
  const select = dialog.getByTestId("dept-manager-select");
  await select.click();
  await select.locator("input").fill(MANAGER_USERNAME);
  const option = page
    .locator(".el-select-dropdown__item:visible")
    .filter({ hasText: MANAGER_USERNAME })
    .first();
  await option.waitFor({ state: "visible" });
  await option.click();
  // 选中生效判据（多选 select 内渲染 tag）：未生效时保存载荷为空会被静默短路
  await expect(select.locator(".el-tag")).toHaveCount(1);
  await dialog.locator(".el-dialog__header").click();
  // 普通点击（不可用 force：点击会派发到坐标处残留的 popper 而非按钮本身；
  // actionability 重试会等待下拉收起后落点）
  const [assignResp] = await Promise.all([
    page.waitForResponse(r => r.url().includes("assign-managers")),
    dialog.getByRole("button", { name: "保存" }).click()
  ]);
  expect(assignResp.status(), await assignResp.text()).toBe(200);
  await expect(page.getByText("管理员已更新").first()).toBeVisible();

  // 列表刷新后行内「部门管理员」列同步展示（格式 昵称(用户名)）
  await expect(row.getByText(MANAGER_USERNAME).first()).toBeVisible();

  // 再次打开弹窗确认装配落库，随后关闭并回收（保持共享库干净）
  await openManagerDialog(page, row);
  const reopened = page.locator(".el-dialog:visible").last();
  await expect(
    reopened.locator(".el-tag").filter({ hasText: MANAGER_USERNAME }).first()
  ).toBeVisible();
  await reopened.locator(".el-dialog__headerbtn").click();

  await assign(page, pk, { remove: [userPk] });
});

test("我的管辖页展示任命范围", async ({ page }) => {
  await login(page);
  const pk = await deptPk(page);
  const userPk = await managerPk(page);
  // 直接建立任命（当前登录用户即管理员），避免依赖上一个用例的副作用
  await assign(page, pk, { add: [userPk] });

  await openMenuPath(page, ["系统管理"], "/system/my-scope/index");
  await expect(page.getByText("管辖部门数")).toBeVisible({ timeout: 10_000 });

  const card = page
    .getByTestId("my-scope-dept")
    .filter({ hasText: DEPT_NAME })
    .first();
  await expect(card).toBeVisible();
  // 直接管辖标记 + 成员数预览入口
  await expect(card.getByText("直接管辖")).toBeVisible();
  await expect(card.getByText(/成员 \d+ 人/)).toBeVisible();

  // 成员预览抽屉（数据权限自动收敛到管辖范围）
  await card.getByTestId("my-scope-members").click();
  const drawer = page.locator(".el-drawer").filter({ hasText: "成员预览" });
  await expect(drawer).toBeVisible();
  await drawer.locator(".el-drawer__close-btn").click();

  // 层级视图：部门树渲染任命范围
  await page.getByText("层级", { exact: true }).click();
  await expect(
    page.locator(".el-tree").getByText(DEPT_NAME, { exact: false }).first()
  ).toBeVisible();

  // 回收（幂等收尾）
  await assign(page, pk, { remove: [userPk] });
});
