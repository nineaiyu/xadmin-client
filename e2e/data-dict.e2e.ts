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
});
