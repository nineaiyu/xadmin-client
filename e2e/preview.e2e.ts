import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  BACKEND_URL,
  DP_USER,
  E2E_USER_AGENT,
  getAccessToken,
  login,
  openMenuPath,
  PLAIN_USER
} from "./helpers";

/**
 * 权限可视化（三层权限预览 + 数据权限试算）E2E 回归。
 *
 * 覆盖计划文档「交互要点」与步骤 5 双角色验证：
 * - 超管：用户预览六分区渲染、API 码关键字过滤、数据权限试算（count/note/SQL）、角色授权预览
 * - 数据权限用户（e2e_dp，规则=仅本人）：预览规则解码文案、试算 count 真实生效（=1）
 * - 普通用户（e2e_user，无角色）：直打预览/试算接口 401/403
 *
 * 环境注意（种子 scripts/e2e_seed.py）：
 * - e2e_dp 的用户列表仅可见本人 → 预览自己的行即表格首行
 * - 受限账号的单页菜单被 pure-admin 提升为顶级链接 a[href="#/system"]
 * - 超管全量菜单超出默认 720px 视口，需加高 viewport（角色页挂在二级目录）
 * - el-dropdown 存在多个隐藏 popup 实例，选项断言必须按可见过滤
 */
test.use({ viewport: { width: 1280, height: 1080 } });

/** 展开行操作下拉并点击按钮（超出 showNumber 时折叠进「更多」） */
async function clickRowButton(page: Page, row: Locator, buttonText: string) {
  const opCell = row.locator("td").last();
  const direct = opCell.getByRole("button", { name: buttonText });
  if (await direct.count()) {
    await direct.first().click();
    return;
  }
  const dropdownTrigger = opCell.locator(".el-dropdown").first();
  await dropdownTrigger.hover();
  await page.waitForTimeout(800);
  const item = page
    .locator(".el-dropdown-menu__item")
    .filter({ hasText: buttonText })
    .locator("visible=true")
    .first();
  await expect(item).toBeVisible({ timeout: 10_000 });
  await item.click();
}

/** 超管：进入用户管理页并打开指定用户行的权限预览抽屉 */
async function openUserPreviewAsAdmin(page: Page, username: string) {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  const row = page
    .locator(".el-table__row")
    .filter({ hasText: username })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await clickRowButton(page, row, "权限预览");
  const drawer = page.locator(".el-drawer").filter({ hasText: "用户权限预览" });
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  return drawer;
}

/** e2e_dp：单页顶级菜单直达用户管理，打开（唯一）本人行的预览抽屉 */
async function openSelfPreviewAsDpUser(page: Page) {
  await login(page, DP_USER);
  const dir = page
    .locator(".el-sub-menu__title", { hasText: "系统管理" })
    .first();
  if (await dir.isVisible().catch(() => false)) {
    await dir.click();
    await page.locator(`a[href="#/system/user/index"]`).first().click();
  } else {
    await page.locator(`a[href="#/system"]`).first().click();
  }
  const table = page.locator(".el-table").first();
  await expect(table).toBeVisible({ timeout: 15_000 });
  const row = page.locator(".el-table__row").first();
  await clickRowButton(page, row, "权限预览");
  const drawer = page.locator(".el-drawer").filter({ hasText: "用户权限预览" });
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  return drawer;
}

/** 在试算区选择模型并点击试算，返回结果容器 */
async function runTrial(page: Page, drawer: Locator, modelKeyword: string) {
  const trial = drawer
    .locator(".el-collapse-item")
    .filter({ hasText: "数据权限试算" });
  // el-plus select 的 placeholder 渲染为 generic 文本而非 input placeholder 属性，按容器定位
  await trial.locator(".el-select").filter({ hasText: "试算模型" }).click();
  const option = page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: modelKeyword })
    .locator("visible=true")
    .first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await expect(option).toContainText("有规则");
  await option.click();
  await trial.getByRole("button", { name: "试算", exact: true }).click();
  // 结果区：命中行数 + SQL 只读 textarea
  await expect(trial.locator("textarea").first()).toBeVisible({
    timeout: 15_000
  });
  return trial;
}

test.describe("用户权限预览（超管）", () => {
  test("六分区渲染与超管旁路提示", async ({ page }) => {
    const drawer = await openUserPreviewAsAdmin(page, "xadmin");
    // 分区标题带计数，精确断言避免与 API 码表格描述列撞车
    await expect(drawer.getByText("基本信息", { exact: true })).toBeVisible();
    await expect(drawer.getByText(/可见菜单树（\d+）/)).toBeVisible();
    await expect(drawer.getByText(/API 权限码（\d+）/)).toBeVisible();
    await expect(drawer.getByText("数据权限", { exact: true })).toBeVisible();
    await expect(drawer.getByText(/字段权限（\d+）/)).toBeVisible();
    await expect(
      drawer.getByText("数据权限试算", { exact: true })
    ).toBeVisible();
    await expect(drawer.getByText("三层权限全部旁路")).toBeVisible();
  });

  test("API 权限码关键字过滤", async ({ page }) => {
    const drawer = await openUserPreviewAsAdmin(page, "xadmin");
    const apiSection = drawer
      .locator(".el-collapse-item")
      .filter({ hasText: "API 权限码" });
    const rows = apiSection.locator(".el-table__row");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const total = await rows.count();
    expect(total).toBeGreaterThan(3);

    await apiSection.getByPlaceholder("输入关键字过滤").fill("preview");
    await expect(apiSection).toContainText("preview:SystemUser");
    await expect(apiSection).toContainText("previewTrial:SystemUser");
    const filtered = await rows.count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);

    await apiSection.getByPlaceholder("输入关键字过滤").fill("");
    await expect(rows).toHaveCount(total);
  });

  test("数据权限试算：count + 超管提示 + SQL", async ({ page }) => {
    const drawer = await openUserPreviewAsAdmin(page, "xadmin");
    const trial = await runTrial(page, drawer, "system.userinfo");
    // 命中行数为正数大字展示
    const hitCount = trial.locator("span.text-xl");
    await expect(hitCount).toBeVisible();
    expect(Number(await hitCount.textContent())).toBeGreaterThan(0);
    // 超管旁路提示
    await expect(trial).toContainText("试算返回全量");
    // SQL 只读回显（SELECT 语句 + 目标表名）
    const sql = await trial.locator("textarea").first().inputValue();
    expect(sql).toContain("SELECT");
    expect(sql).toContain("userinfo");
  });
});

test.describe("数据权限预览与试算（e2e_dp：仅本人规则真实生效）", () => {
  test("个人授权分组与规则解码文案", async ({ page }) => {
    const drawer = await openSelfPreviewAsDpUser(page);

    // 规则解码：授权名 + 目标用户本人（value.user.id → 目标用户本人(username)）
    await expect(drawer).toContainText("E2E-仅本人用户数据");
    await expect(drawer).toContainText("目标用户本人");
    // 有授权 → 不出现「无任何授权默认不可见」警告
    await expect(drawer).not.toContainText("无任何数据权限授权，默认不可见");
    // 语义注释 alert 渲染
    await expect(drawer).toContainText("部门祖先链各层授权之间为「且」组合");
  });

  test("试算仅命中本人（count = 1）", async ({ page }) => {
    const drawer = await openSelfPreviewAsDpUser(page);
    const trial = await runTrial(page, drawer, "system.userinfo");
    const hitCount = trial.locator("span.text-xl");
    await expect(hitCount).toBeVisible();
    expect(Number(await hitCount.textContent())).toBe(1);
    // e2e_dp 无超管旁路 → 不出现全量提示
    await expect(trial).not.toContainText("试算返回全量");
  });
});

test.describe("角色授权预览（超管）", () => {
  test("授权菜单树、字段授权与持有用户表", async ({ page }) => {
    await login(page);
    // 角色管理页面菜单挂在「系统管理 → 权限管理」二级目录下（种子 menu.json）
    await openMenuPath(page, ["系统管理", "权限管理"], "/system/role/index");
    const row = page.locator(".el-table__row").first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await clickRowButton(page, row, "授权预览");

    const drawer = page
      .locator(".el-drawer")
      .filter({ hasText: "角色授权预览" });
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    await expect(drawer.getByText("该角色授权的菜单")).toBeVisible();
    await expect(drawer.getByText(/持有该角色的用户（\d+）/)).toBeVisible();
    // 持有用户表格渲染（行数 = min(total, 20)，种子角色用户数均 <= 20）
    const userRows = drawer.locator(".el-table__row");
    const count = await userRows.count();
    if (count > 0) {
      await expect(userRows.first()).toBeVisible();
    }
    // 未截断时不出现「仅显示前」文案
    await expect(drawer).not.toContainText("仅显示前");
  });
});

test.describe("预览接口鉴权（普通用户）", () => {
  test("匿名 401 / 无码 403 / 试算 403", async ({ page }) => {
    await login(page, PLAIN_USER);
    const token = await getAccessToken(page);
    expect(token).toBeTruthy();
    const anon = await page.request.get(
      `${BACKEND_URL}/api/system/user/1/preview`,
      {
        headers: { "User-Agent": E2E_USER_AGENT }
      }
    );
    expect(anon.status()).toBe(401);
    const resp = await page.request.get(
      `${BACKEND_URL}/api/system/user/1/preview`,
      {
        headers: {
          "User-Agent": E2E_USER_AGENT,
          Authorization: `Bearer ${token}`
        }
      }
    );
    expect(resp.status()).toBe(403);
    const trial = await page.request.post(
      `${BACKEND_URL}/api/system/user/1/preview/trial`,
      {
        headers: {
          "User-Agent": E2E_USER_AGENT,
          Authorization: `Bearer ${token}`
        },
        data: { model: "system.userinfo" }
      }
    );
    expect(trial.status()).toBe(403);
  });
});
