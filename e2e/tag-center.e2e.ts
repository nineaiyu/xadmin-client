import { expect, test } from "@playwright/test";

import {
  FRONT_URL,
  getAccessToken,
  HIGH_LOAD,
  login,
  openMenuPath
} from "./helpers";

/**
 * 通用标签中心（双浏览器）：标签页新建 → 对象打标 → 列表按标签筛选 → 引用保护。
 *
 * 确定性设计（共享库 + 双浏览器并发视角）：
 * - 标签名与被标对象都带时间戳（固定名会撞唯一约束）；
 * - 被标用户经 API 新建 → 用户列表默认按创建时间倒序 → 目标行必在第一行；
 * - 打标动作走 `tags/assign` 接口（与界面同一端点、同一权限链），
 *   界面部分覆盖「标签管理页 CRUD」「用户列表标签列渲染」「搜索区标签下拉过滤」
 *   「被引用标签删除保护」——行内打标弹窗的交互由组件逻辑与接口集成测试覆盖，
 *   避免行操作折叠进「更多」下拉后的定位脆弱性（见 e2e/README 陷阱表）。
 */
const TAG_NAME = `E2E标签${Date.now()}`;
const USERNAME = `e2etag${Date.now()}`;

async function openTagCenter(page: import("@playwright/test").Page) {
  await openMenuPath(page, ["系统管理"], "/system/tag/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
}

async function expandSearchCard(page: import("@playwright/test").Page) {
  // 折叠态的「展开」在不同断点渲染为 button 或 link（PlusSearch 两形态），两者都试
  const expand = page
    .getByRole("button", { name: /展开/ })
    .or(page.getByRole("link", { name: /展开/ }))
    .first();
  if (await expand.isVisible().catch(() => false)) {
    await expand.click({ timeout: 3_000 }).catch(() => null);
  }
}

test("标签中心：新建 → 打标 → 按标签筛选 → 引用保护", async ({ page }) => {
  if (HIGH_LOAD) test.slow();
  await login(page);
  const token = await getAccessToken(page);
  const auth = { Authorization: `Bearer ${token}` };

  // 0) 新建一个确定性用户（列表默认倒序 → 第一行即目标行）
  const created = await page.request.post(`${FRONT_URL}/api/identity/user`, {
    headers: auth,
    data: {
      username: USERNAME,
      nickname: "标签E2E",
      password: "E2e-Tag-Pass-2026!",
      is_active: true
    }
  });
  expect(created.status(), await created.text()).toBe(200);
  const userId = String((await created.json())?.data?.pk ?? "");
  expect(userId).not.toBe("");

  // 1) 标签管理页：新建标签（框架元数据表单）+ 列表出现（使用计数 0）
  await openTagCenter(page);
  await page.getByRole("button", { name: "新增", exact: true }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible();
  await dialog
    .locator(".el-form-item")
    .filter({ hasText: "标签名称" })
    .locator("input")
    .fill(TAG_NAME);
  // 颜色列由后端 ColorField（input_type=color）驱动，必须是颜色选择器而非文本输入
  const colorItem = dialog
    .locator(".el-form-item")
    .filter({ hasText: "颜色" })
    .first();
  await expect(colorItem.locator(".el-color-picker")).toBeVisible();
  await colorItem.locator(".el-color-picker__trigger").click();
  // Element Plus 2.14 的取色面板是 `.el-color-picker__panel`（非旧版 el-color-dropdown）；
  // 直接点语义色板（页面注入的项目色板），再从 DOM 读出实际颜色用于落库断言
  const swatch = page
    .locator(
      ".el-color-picker__panel:visible .el-color-predefine__color-selector"
    )
    .first();
  const rgb = await swatch
    .locator("div")
    .evaluate(el => getComputedStyle(el).backgroundColor);
  const pickedColor = `#${(rgb.match(/\d+/g) ?? [])
    .slice(0, 3)
    .map(v => Number(v).toString(16).padStart(2, "0"))
    .join("")}`;
  await swatch.click();
  // 面板确认按钮（EP 2.14：`.el-color-footer__btn`）提交选中值
  await page
    .locator(".el-color-picker__panel:visible .el-color-footer__btn")
    .click();
  await dialog.getByRole("button", { name: /保存|确定/ }).click();
  const tagRow = page.getByRole("row", { name: new RegExp(TAG_NAME) }).first();
  await expect(tagRow).toBeVisible({ timeout: 10_000 });

  // 2) 打标（同一端点：全量替换语义，权限回落用户对象 update 权限点）
  const tagPk = String(
    (
      (
        await (
          await page.request.get(
            `${FRONT_URL}/api/system/tags?name=${TAG_NAME}`,
            { headers: auth }
          )
        ).json()
      )?.data?.results?.[0] ?? {}
    ).pk ?? ""
  );
  expect(tagPk).not.toBe("");
  // 颜色写入路径：值必须按原样落库（证明选择器绑定的是同一个 color 字段）
  const savedTag = await (
    await page.request.get(`${FRONT_URL}/api/system/tags?name=${TAG_NAME}`, {
      headers: auth
    })
  ).json();
  expect(savedTag?.data?.results?.[0]?.color).toBe(pickedColor);
  const assigned = await page.request.post(
    `${FRONT_URL}/api/system/tags/assign`,
    {
      headers: auth,
      data: { resource: "identity.userinfo", pk: userId, tags: [tagPk] }
    }
  );
  expect(assigned.status(), await assigned.text()).toBe(200);

  // 3) 用户列表：第一行渲染标签（tags 列）
  await page.goto("/#/system/user/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  const firstRow = page.locator(".el-table__body-wrapper tbody tr").first();
  await expect(firstRow).toContainText(USERNAME, { timeout: 10_000 });
  await expect(firstRow).toContainText(TAG_NAME, { timeout: 10_000 });

  // 4) 搜索区「标签」下拉（元数据下发）过滤 → 只剩被打标行
  await expandSearchCard(page);
  const tagItem = page.locator(".el-form-item", { hasText: "标签" }).first();
  await expect(tagItem).toBeVisible({ timeout: 10_000 });
  await tagItem.locator(".el-select").first().click();
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item")
    .filter({ hasText: TAG_NAME })
    .first()
    .click();
  await page.getByRole("button", { name: "搜索", exact: true }).first().click();
  const filteredRow = page.locator(".el-table__body-wrapper tbody tr").first();
  await expect(filteredRow).toContainText(USERNAME, { timeout: 10_000 });
  await expect(filteredRow).toContainText(TAG_NAME);

  // 5) 引用保护：删除被引用的标签 → 报错且标签仍在（使用计数可查）
  const blocked = await page.request.delete(
    `${FRONT_URL}/api/system/tags/${tagPk}`,
    {
      headers: auth
    }
  );
  expect(blocked.status()).toBe(400);
  await openTagCenter(page);
  const stillThere = page
    .getByRole("row", { name: new RegExp(TAG_NAME) })
    .first();
  await expect(stillThere).toBeVisible();
  await expect(stillThere).toContainText("1");
});
