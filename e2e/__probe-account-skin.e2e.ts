import { test } from "@playwright/test";
import { ADMIN, login } from "./helpers";

/** 临时诊断探针（排查用，不长期保留）：布局存储键与暗色写入 */
test("probe: 布局存储键", async ({ page }) => {
  await login(page, ADMIN);
  const keys = await page.evaluate(() =>
    Object.keys(localStorage).map(key => ({
      key,
      preview: String(localStorage.getItem(key)).slice(0, 120)
    }))
  );

  console.log("PROBE keys " + JSON.stringify(keys));
});
