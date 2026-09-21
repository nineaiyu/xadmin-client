import { expect, test, type Page } from "@playwright/test";
import { statSync } from "node:fs";

import {
  APPROVER,
  BACKEND_URL,
  DOWNLOAD_TIMEOUT,
  FRONT_URL,
  getAccessToken,
  login,
  openMenuPath,
  PLAIN_USER
} from "./helpers";

/**
 * 审批批量转交 + 导出（CSV）+ 节点进度（达标线）E2E：
 * 1）批量转交：勾选多条待办 → 一次交给同一人 → 待办清空（服务端逐条独立）；
 * 2）导出：工具栏导出弹层选 CSV → 真下载 csv 文件（框架曾把 type 忽略恒回 xlsx）；
 * 3）节点进度：详情抽屉展示当前节点进度标签（比例会签的达标线预览数据源）。
 */

const INSTANCE_URL = "/system/approval/instance/index";
const LIST_URL = `${BACKEND_URL}/api/system/approval-instances`;

/**
 * 内建导出按钮：按 aria-label 定位（框架给图标按钮带 aria-label="导出"）。
 * 必须加 :visible——页面存在多个同名按钮（隐藏副本），index/首个匹配会命中隐藏节点。
 */
const exportButton = (page: Page) =>
  page.locator('button[aria-label="导出"]:visible').first();

async function createFlow(page: Page, token: string, code: string) {
  const resp = await page.request.post(
    `${BACKEND_URL}/api/system/approval-flows`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `E2E流程-${code}`,
        code,
        form_schema: [],
        nodes: [
          {
            name: "初审",
            order: 1,
            approve_type: "AND",
            assignee_type: "user",
            assignee_value: APPROVER.username
          }
        ]
      }
    }
  );
  expect(resp.ok(), await resp.text()).toBeTruthy();
  return (await resp.json()).data.pk as string;
}

async function startInstance(
  page: Page,
  token: string,
  flowPk: string,
  title: string
) {
  const resp = await page.request.post(LIST_URL, {
    headers: { Authorization: `Bearer ${token}` },
    data: { flow: flowPk, title, form_data: {} }
  });
  expect(resp.ok(), await resp.text()).toBeTruthy();
  return (await resp.json()).data.pk as string;
}

async function openInstanceCenter(page: Page) {
  await openMenuPath(page, ["系统管理"], INSTANCE_URL);
  await expect(page.getByRole("tab", { name: /待我审批/ }).first()).toBeVisible(
    {
      timeout: 20_000
    }
  );
}

test("审批：批量转交多条待办给同一人", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const stamp = Date.now();
  const titles = [`E2E批量A-${stamp}`, `E2E批量B-${stamp}`];
  const flowPk = await createFlow(page, token, `e2e_batch_${stamp}`);
  for (const title of titles) {
    await startInstance(page, token, flowPk, title);
  }

  const browser = page.context().browser();
  const approverContext = await browser!.newContext({
    baseURL: FRONT_URL,
    locale: "zh-CN"
  });
  const approverPage = await approverContext.newPage();
  await login(approverPage, APPROVER);
  await openInstanceCenter(approverPage);

  // 勾选两条待办（行的多选列）
  for (const title of titles) {
    const row = approverPage
      .locator(".el-table__row", { hasText: title })
      .first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.locator(".el-checkbox").first().click();
  }

  await approverPage.getByRole("button", { name: "批量转交" }).first().click();
  const dialog = approverPage.locator(".el-dialog:visible").first();
  await expect(dialog).toContainText("批量转交", { timeout: 10_000 });

  // 选人：超管走 SearchUser 弹窗选择器，无该权限时回退用户名输入
  const targetItem = dialog.locator(".el-form-item:has-text('转交给')").first();
  const plainInput = targetItem.getByPlaceholder("请输入被转交人的用户名");
  if ((await plainInput.count()) > 0) {
    await plainInput.fill(PLAIN_USER.username);
  } else {
    await targetItem.locator(".el-select__wrapper").first().click();
    const pickerSearch = approverPage.getByPlaceholder("请输入用户名");
    await pickerSearch.waitFor({ state: "visible", timeout: 15_000 });
    await pickerSearch.fill(PLAIN_USER.username);
    await approverPage
      .getByRole("tooltip")
      .filter({ has: pickerSearch })
      .getByRole("button", { name: "搜索" })
      .click();
    const pickerRow = approverPage
      .locator(".el-table")
      .last()
      .locator(".el-table__row")
      .filter({ hasText: PLAIN_USER.username })
      .first();
    await expect(pickerRow).toBeVisible({ timeout: 15_000 });
    await pickerRow.click();
    await approverPage
      .locator(".el-select__popper:visible")
      .getByRole("button", { name: "确定" })
      .first()
      .click();
  }

  await dialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  await expect(approverPage.locator(".el-message").first()).toContainText(
    /条已转交|transferred/i,
    { timeout: 15_000 }
  );
  // 两条都离开「待我审批」
  for (const title of titles) {
    await expect(
      approverPage.locator(".el-table__row", { hasText: title })
    ).toHaveCount(0, { timeout: 20_000 });
  }
  await approverContext.close();
});

test("审批：导出 CSV 真下载 + 详情展示节点进度", async ({ page }) => {
  test.slow();
  await login(page);
  const token = await getAccessToken(page);
  const stamp = Date.now();
  const title = `E2E导出-${stamp}`;
  const flowPk = await createFlow(page, token, `e2e_export_${stamp}`);
  const instancePk = await startInstance(page, token, flowPk, title);

  await openInstanceCenter(page);
  await page.getByRole("tab", { name: "我的申请" }).first().click();
  const row = page.locator(".el-table__row", { hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });

  // ---- 导出：弹层选 CSV → 下载 csv ----
  await expect(exportButton(page)).toBeVisible({ timeout: 20_000 });
  await exportButton(page).click();
  // :visible 必须显式限定：Element Plus 关闭的弹窗会保留 DOM，.first() 会命中残留节点
  const exportDialog = page
    .locator(".el-dialog:visible", { hasText: "导出" })
    .first();
  await expect(exportDialog).toBeVisible({ timeout: 15_000 });
  await exportDialog
    .locator(".el-radio:visible", { hasText: /csv/i })
    .first()
    .click();
  const downloadPromise = page.waitForEvent("download", {
    timeout: DOWNLOAD_TIMEOUT
  });
  await exportDialog
    .getByRole("button", { name: /保存|确定/ })
    .first()
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const filePath = await download.path();
  expect(statSync(filePath as string).size).toBeGreaterThan(64);

  // ---- 详情抽屉：节点进度（达标线预览）可见 ----
  const detailRow = page.locator(".el-table__row", { hasText: title }).first();
  await detailRow.getByRole("button", { name: "申请详情" }).first().click();
  const drawer = page.locator(".el-drawer:visible").first();
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  await expect(drawer.getByTestId("node-progress-tag")).toBeVisible({
    timeout: 10_000
  });
  await expect(drawer.getByTestId("node-progress-tag")).toContainText(
    /需 \d+ 人|required/
  );
  expect(instancePk).toBeTruthy();
});
