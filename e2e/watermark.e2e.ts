import { expect, test } from "@playwright/test";

import { FRONT_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 站点水印（ADR-029，G10）：基本设置开启后，只有「生效页面」范围内的页面挂水印节点。
 *
 * 断言口径：`@pureadmin/utils` 的水印容器是 id 为 `Symbol(watermark-dom)` 的固定层
 * （文案烧进 canvas 背景图，故断言节点与其 background 样式，不解析文本）。
 *
 * 用例自建于接口配置，跑完必定还原（保持 FRONT_END_WEB_WATERMARK_ENABLED=false），
 * 避免污染其它用例的页面（水印是全屏固定层）。
 */

const WATERMARK_NODE = "[id='Symbol(watermark-dom)']";
const SENSITIVE_PATH = "/system/user/index";
const OTHER_PATH = "/analysis/dashboard/index";

async function saveWatermarkSetting(
  page: import("@playwright/test").Page,
  data: Record<string, unknown>
) {
  const token = await getAccessToken(page);
  const response = await page.request.patch(`${FRONT_URL}/api/settings/basic`, {
    data,
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.code).toBe(1000);
}

/** 刷新应用以重新拉取用户信息（水印配置随之刷新；token 在本地，刷新后仍是登录态） */
async function reloadApp(page: import("@playwright/test").Page) {
  await page.reload();
  await expect(page.getByRole("menuitem").first()).toBeVisible({
    timeout: 30_000
  });
}

test.describe("站点水印（敏感页面范围）", () => {
  test.afterEach(async ({ page }) => {
    await saveWatermarkSetting(page, {
      FRONT_END_WEB_WATERMARK_ENABLED: false,
      FRONT_END_WEB_WATERMARK_TEXT: "",
      FRONT_END_WEB_WATERMARK_PATHS: ""
    });
  });

  test("开启后命中范围页面挂水印，范围外页面不挂", async ({ page }) => {
    await login(page);
    await saveWatermarkSetting(page, {
      FRONT_END_WEB_WATERMARK_ENABLED: true,
      FRONT_END_WEB_WATERMARK_TEXT: "E2E水印",
      FRONT_END_WEB_WATERMARK_PATHS: SENSITIVE_PATH
    });
    await reloadApp(page);

    // 命中范围：用户管理页出现水印层，且背景为 canvas 生成的图
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    const watermark = page.locator(WATERMARK_NODE).first();
    await expect(watermark).toBeAttached({ timeout: 15_000 });
    await expect(watermark).toHaveAttribute("style", /data:image\/png/);

    // 范围外：仪表盘页不挂水印（切页即清除）
    await openMenuPath(page, ["数据分析"], "/analysis/dashboard/index");
    await expect(page.locator(WATERMARK_NODE)).toHaveCount(0);
  });

  test("生效页面为空 = 全部页面；改为非命中范围后不再挂载", async ({
    page
  }) => {
    await login(page);
    await saveWatermarkSetting(page, {
      FRONT_END_WEB_WATERMARK_ENABLED: true,
      FRONT_END_WEB_WATERMARK_TEXT: "",
      FRONT_END_WEB_WATERMARK_PATHS: ""
    });
    await reloadApp(page);
    await openMenuPath(page, ["系统管理"], "/system/user/index");
    await expect(page.locator(WATERMARK_NODE).first()).toBeAttached({
      timeout: 15_000
    });

    // 改为非命中范围后刷新：同一页面水印层消失
    await saveWatermarkSetting(page, {
      FRONT_END_WEB_WATERMARK_ENABLED: true,
      FRONT_END_WEB_WATERMARK_PATHS: OTHER_PATH
    });
    await reloadApp(page);
    await expect(page.locator(WATERMARK_NODE)).toHaveCount(0);
  });
});
