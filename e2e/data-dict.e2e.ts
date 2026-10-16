import { expect, test } from "@playwright/test";

import { FRONT_URL, login, openMenuPath } from "./helpers";

/**
 * 数据字典全流程：创建类型与字典项 → 列表页可见 → items 消费接口（含缓存失效）。
 * 接口断言走同源 FRONT_URL（携带会话 Cookie）。
 */
test("数据字典：类型/字典项创建、页面展示与 items 消费", async ({ page }) => {
  await login(page);

  const code = `e2e_dict_${Date.now()}`;
  const typeResp = await page.request.post(`${FRONT_URL}/api/system/dict`, {
    data: { code, label: "E2E字典" }
  });
  const typePayload = await typeResp.json();
  expect(typePayload.code, `create type: ${JSON.stringify(typePayload)}`).toBe(
    1000
  );

  const listResp = await page.request.get(
    `${FRONT_URL}/api/system/dict?code=${code}`
  );
  const listPayload = await listResp.json();
  const typePk = listPayload.data.results[0].pk;

  for (const [itemCode, label] of [
    ["a", "选项A"],
    ["b", "选项B"]
  ]) {
    const resp = await page.request.post(`${FRONT_URL}/api/system/dict`, {
      data: { parent: typePk, code: itemCode, label, value: itemCode }
    });
    const payload = await resp.json();
    expect(
      payload.code,
      `create item ${itemCode}: ${JSON.stringify(payload)}`
    ).toBe(1000);
  }

  // 打开页面：类型与字典项均可见（parent 列显示类型名）
  await openMenuPath(page, ["系统管理"], "/system/dict/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  await expect(
    page.locator(".el-table__row", { hasText: code }).first()
  ).toBeVisible();
  await expect(
    page.locator(".el-table__row", { hasText: "选项A" }).first()
  ).toBeVisible();

  // items 消费接口：返回启用字典项
  const itemsResp = await page.request.get(
    `${FRONT_URL}/api/system/dict/items?code=${code}`
  );
  const items = (await itemsResp.json()).data.results;
  expect(items).toHaveLength(2);
  expect(items[0].label).toBe("选项A");

  // 停用一项后 items 仅返回启用项（保存信号已失效缓存）
  const itemResp = await page.request.get(
    `${FRONT_URL}/api/system/dict?parent=${typePk}&code=a`
  );
  const itemPk = (await itemResp.json()).data.results[0].pk;
  await page.request.patch(`${FRONT_URL}/api/system/dict/${itemPk}`, {
    data: { is_active: false }
  });
  const itemsAfter = await page.request.get(
    `${FRONT_URL}/api/system/dict/items?code=${code}`
  );
  expect((await itemsAfter.json()).data.results).toHaveLength(1);

  // 批量启用：逐个 save 触发信号，items 立即反映新状态
  const itemsUrl = `${FRONT_URL}/api/system/dict/items?code=${code}`;
  const batchResp = await page.request.post(
    `${FRONT_URL}/api/system/dict/batch-active`,
    { data: { pks: [itemPk], is_active: true } }
  );
  expect((await batchResp.json()).code, "batch-active enable").toBe(1000);
  expect(
    (await (await page.request.get(itemsUrl)).json()).data.results
  ).toHaveLength(2);

  // 上移/下移：同层重排 sort，消费端顺序同步（update 绕过信号，缓存由 action 失效）
  const siblings = (
    await (
      await page.request.get(`${FRONT_URL}/api/system/dict?parent=${typePk}`)
    ).json()
  ).data.results as Array<{ pk: string; code: string }>;
  const firstPk = siblings.find(row => row.code === "a")?.pk;
  expect(firstPk, "dict item a exists").toBeTruthy();
  const moveResp = await page.request.post(
    `${FRONT_URL}/api/system/dict/${firstPk}/move`,
    { data: { direction: "down" } }
  );
  expect((await moveResp.json()).code, "move down").toBe(1000);
  const reordered = (await (await page.request.get(itemsUrl)).json()).data
    .results;
  expect(reordered[0].value).toBe("b");

  // 刷新缓存
  const refreshResp = await page.request.post(
    `${FRONT_URL}/api/system/dict/refresh-cache`
  );
  expect((await refreshResp.json()).code, "refresh-cache").toBe(1000);
  expect(
    (await (await page.request.get(itemsUrl)).json()).data.results
  ).toHaveLength(2);
});

/**
 * 树表交互：类型行「新增子项」直接在该类型下建项；工具栏批量启停/刷新缓存可用；
 * 行内上移/下移按钮平铺展示（操作列宽度与 showNumber 由页面 hook 配置）。
 */
test("数据字典：树表新增子项与工具栏按钮", async ({ page }) => {
  await login(page);

  const code = `e2e_tree_${Date.now()}`;
  const typeResp = await page.request.post(`${FRONT_URL}/api/system/dict`, {
    data: { code, label: "E2E树字典" }
  });
  expect(typeResp.status(), "create type").toBeLessThan(400);

  const seedResp = await page.request.get(
    `${FRONT_URL}/api/system/dict?code=${code}`
  );
  const typePk = (await seedResp.json()).data.results[0].pk;
  const itemResp = await page.request.post(`${FRONT_URL}/api/system/dict`, {
    data: { parent: typePk, code: "seed", label: "预置项", value: "seed" }
  });
  expect((await itemResp.json()).code, "create seed item").toBe(1000);

  await openMenuPath(page, ["系统管理"], "/system/dict/index");
  const table = page.locator(".el-table").first();
  await expect(table).toBeVisible({ timeout: 15_000 });

  // 树形：类型行与其子项行同时可见（默认全部展开）
  const typeRow = page.locator(".el-table__row", { hasText: code }).first();
  await expect(typeRow).toBeVisible();
  await expect(
    page.locator(".el-table__row", { hasText: "预置项" }).first()
  ).toBeVisible();

  // 行内按钮：新增子项/上移/下移 均平铺可见
  await expect(
    typeRow.getByRole("button", { name: "新增子项" }).first()
  ).toBeVisible();
  await expect(
    typeRow.getByRole("button", { name: "上移" }).first()
  ).toBeVisible();
  await expect(
    typeRow.getByRole("button", { name: "下移" }).first()
  ).toBeVisible();

  // 类型行「新增子项」→ 弹窗预填所属类型，保存后进入该类型
  await typeRow.getByRole("button", { name: "新增子项" }).first().click();
  const dialog = page.locator(".el-dialog:visible, .el-drawer:visible").first();
  await expect(dialog).toBeVisible();
  await dialog
    .locator(".el-form-item:has-text('字典编码') input")
    .first()
    .fill("child");
  await dialog
    .locator(".el-form-item:has-text('显示名称') input")
    .first()
    .fill("新增子项");
  await dialog
    .locator(".el-form-item:has-text('字典值') input")
    .first()
    .fill("child");
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });

  const itemsUrl = `${FRONT_URL}/api/system/dict/items?code=${code}`;
  await expect
    .poll(
      async () =>
        (await (await page.request.get(itemsUrl)).json()).data.results.length,
      { timeout: 15_000 }
    )
    .toBe(2);

  // 工具栏：批量启用/停用/刷新缓存 可见，点刷新缓存后给出成功提示
  await expect(
    page.getByRole("button", { name: "批量启用" }).first()
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "批量停用" }).first()
  ).toBeVisible();
  await page.getByRole("button", { name: "刷新缓存" }).first().click();
  await expect(page.locator(".el-message--success").first()).toBeVisible({
    timeout: 15_000
  });
});
