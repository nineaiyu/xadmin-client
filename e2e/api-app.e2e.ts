import { expect, test } from "@playwright/test";

import { login, openMenuPath } from "./helpers";

/**
 * 开放平台 API 应用：管理页新建应用 → 一次性密钥只展示一次。
 * 换发/限流/回调的服务端口径由 tests/integration/system/test_api_application.py 钉死。
 */

test("API 应用：新建应用并展示一次性密钥", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["集成管理"], "/integration/api-app/index");
  await expect(page.getByTestId("api-app-table")).toBeVisible({
    timeout: 15_000
  });

  await page.getByTestId("api-app-create").click();
  await page.locator(".el-dialog input").first().fill("E2E 应用");
  await page.getByTestId("api-app-submit").click();

  // 创建响应携带一次性明文密钥：弹窗立即展示（列表不回传明文）
  const credentialDialog = page.locator(".el-dialog", {
    hasText: "一次性密钥"
  });
  await expect(credentialDialog.locator("input").nth(1)).toHaveValue(/^aps_/, {
    timeout: 15_000
  });
  await page.getByRole("button", { name: "确定" }).last().click();
  await expect(page.getByText("E2E 应用").first()).toBeVisible();
});
