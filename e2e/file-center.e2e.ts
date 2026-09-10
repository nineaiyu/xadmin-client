import { expect, test } from "@playwright/test";

import { FRONT_URL, login, openMenuPath } from "./helpers";

/**
 * 文件中心增强（F2 裁剪版）：个人配额统计卡片 + 分类（字典驱动）下拉筛选。
 *
 * 去重与保留期清理在评审复盘后降级候选池（去重记录复用 filepath 会与磁盘
 * 删除产生悬挂引用），不在本用例范围；后端单测见
 * xadmin-server/tests/unit/system/test_upload_enhance.py。
 */
test("文件中心：上传刷新统计卡片 + 分类下拉筛选", async ({ page }) => {
  await login(page);

  // 基线统计（?no_cache=1 穿透服务端 10s 短缓存，保证读到真实值）
  const baseResp = await page.request.get(
    `${FRONT_URL}/api/system/file/stats?no_cache=1`
  );
  const basePayload = await baseResp.json();
  expect(basePayload.code, `stats: ${JSON.stringify(basePayload)}`).toBe(1000);
  const baseCount = basePayload.data.count as number;

  await openMenuPath(page, ["系统管理"], "/system/file/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });

  // 顶部配额统计卡片：初始数量与基线一致
  const card = page.locator(".el-card", { hasText: "存储使用" }).first();
  await expect(card).toBeVisible();
  await expect(card).toContainText(`文件数量: ${baseCount}`);

  // 上传弹窗上传一个文件：成功后 loadStats(true) 穿透短缓存刷新卡片数量
  const filename = `e2e-file-${Date.now()}.txt`;
  await page.getByRole("button", { name: "上传" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog
    .locator("input[type='file']")
    .first()
    .setInputFiles({
      name: filename,
      mimeType: "text/plain",
      buffer: Buffer.from("hello e2e file center")
    });
  await expect(card).toContainText(`文件数量: ${baseCount + 1}`, {
    timeout: 15_000
  });

  // 重新加载页面（收起上传弹窗），取出该文件的 pk 并写入字典分类
  await page.reload();
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  const listResp = await page.request.get(
    `${FRONT_URL}/api/system/file?filename=${encodeURIComponent(filename)}`
  );
  const listPayload = await listResp.json();
  const row = listPayload.data.results[0];
  expect(row?.pk, `uploaded row: ${JSON.stringify(listPayload)}`).toBeTruthy();
  const patchResp = await page.request.patch(
    `${FRONT_URL}/api/system/file/${row.pk}`,
    { data: { category: "image" } }
  );
  expect((await patchResp.json()).code, "set category").toBe(1000);

  // 分类列按字典 renderer 渲染彩色标签（label = 图片）
  await page.reload();
  const table = page.locator(".el-table").first();
  await expect(table).toBeVisible({ timeout: 15_000 });
  const targetRow = table
    .locator(".el-table__row", { hasText: filename })
    .first();
  await expect(targetRow).toBeVisible({ timeout: 15_000 });
  await expect(targetRow).toContainText("图片");

  // 搜索区默认折叠，展开后按「分类 = 图片」筛选
  const expand = page.getByRole("button", { name: /展开/ });
  if (await expand.isVisible().catch(() => false)) {
    await expand.click();
  }
  const categoryItem = page
    .locator(".el-form-item", { hasText: "分类" })
    .first();
  await categoryItem.locator(".el-select").click();
  const option = page
    .locator(".el-select-dropdown__item")
    .filter({ hasText: "图片" })
    .locator("visible=true")
    .first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
  await page.getByRole("button", { name: "搜索" }).first().click();

  // 过滤后目标行仍在（分类命中）
  await expect(
    page.locator(".el-table__row", { hasText: filename }).first()
  ).toBeVisible({ timeout: 15_000 });
});
