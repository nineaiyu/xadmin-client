import { expect, test } from "@playwright/test";

import { FRONT_URL, login, openMenuPath } from "./helpers";

/**
 * 文件中心增强（F2）：个人配额统计卡片 + 分类（字典驱动）下拉筛选 + 上传去重。
 *
 * 保留期清理（FILE_KEEP_DAYS）默认 0 = 不清理，且属定时任务行为，由后端单测覆盖
 * （xadmin-server/tests/unit/system/test_upload_enhance.py 的守护与清理用例）。
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

/**
 * 上传去重（F2）：同一文件重复上传复用磁盘副本（access_url 相同），
 * 配额仍按记录全量计入（保守口径：数量 +2、大小按两条记录计）。
 */
test("文件中心：重复上传同一文件复用磁盘副本", async ({ page }) => {
  await login(page);

  const filename = `e2e-dedup-${Date.now()}.txt`;
  const content = "dedup e2e content";

  const statsResp = await page.request.get(
    `${FRONT_URL}/api/system/file/stats?no_cache=1`
  );
  const baseCount = (await statsResp.json()).data.count as number;

  // 第一次：API 上传
  const firstResp = await page.request.post(
    `${FRONT_URL}/api/system/file/upload`,
    {
      multipart: {
        file: {
          name: filename,
          mimeType: "text/plain",
          buffer: Buffer.from(content)
        }
      }
    }
  );
  const firstPayload = await firstResp.json();
  expect(firstPayload.code, `upload: ${JSON.stringify(firstPayload)}`).toBe(
    1000
  );

  // 第二次：走 UI 上传同一文件 → 成功后提示「已复用」
  await openMenuPath(page, ["系统管理"], "/system/file/index");
  await expect(page.locator(".el-table").first()).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole("button", { name: "上传" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog
    .locator("input[type='file']")
    .first()
    .setInputFiles({
      name: filename,
      mimeType: "text/plain",
      buffer: Buffer.from(content)
    });
  await expect(page.locator(".el-message").last()).toContainText("复用", {
    timeout: 15_000
  });

  // 两条记录指向同一物理文件（access_url 相同）＋配额按记录全量计入
  const listResp = await page.request.get(
    `${FRONT_URL}/api/system/file?filename=${encodeURIComponent(filename)}`
  );
  const results = (await listResp.json()).data.results as Array<
    Record<string, unknown>
  >;
  expect(results.length).toBe(2);
  expect(results[0].access_url).toBe(results[1].access_url);

  const afterResp = await page.request.get(
    `${FRONT_URL}/api/system/file/stats?no_cache=1`
  );
  expect((await afterResp.json()).data.count).toBe(baseCount + 2);
});
