import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";

import {
  DOWNLOAD_TIMEOUT,
  FRONT_URL,
  HIGH_LOAD,
  getAccessToken,
  login,
  openMenuPath
} from "./helpers";

/**
 * 表单数据（管理端）：选择表单 → 动态列浏览 → 详情抽屉 → 导出。
 *
 * 数据准备走 API（定义表单 + 一条提交）；本页为只读管理面，行可见性由后端
 * 数据权限编译器收敛（超管全量）。表单在用例末尾删除（双浏览器共享库，避免残留）。
 */

async function createFormScene(
  page: import("@playwright/test").Page,
  suffix: string
) {
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const formName = `E2E表单数据-${suffix}`;
  const deviceName = `E2E路由器-${suffix}`;

  const formRes = await page.request.post(
    `${FRONT_URL}/api/dataset/dynamic-forms`,
    {
      headers,
      data: {
        name: formName,
        description: "E2E 表单数据管理面",
        is_active: true,
        schema: {
          fields: [
            { key: "device", label: "设备名称", type: "input", required: true },
            { key: "count", label: "数量", type: "number" },
            { key: "enabled", label: "启用", type: "switch" }
          ]
        }
      }
    }
  );
  expect(formRes.ok(), await formRes.text()).toBeTruthy();
  const formPk = (await formRes.json()).data.pk;

  const filled = await page.request.post(
    `${FRONT_URL}/api/dataset/dynamic-form-submissions`,
    {
      headers,
      data: {
        form: formPk,
        data: { device: deviceName, count: 3, enabled: true }
      }
    }
  );
  expect(filled.ok(), await filled.text()).toBeTruthy();
  return { formPk, formName, deviceName, headers };
}

async function openFormDataPage(
  page: import("@playwright/test").Page,
  formName: string
) {
  await openMenuPath(page, ["表单采集"], "/form-collection/data/index");
  const formSelect = page.getByTestId("form-data-form-select");
  await expect(formSelect).toBeVisible({ timeout: 15_000 });
  await formSelect.click();
  // el-select 面板会保留多份 popper 副本：限定可见项避免 strict mode violation
  await page
    .locator(".el-select-dropdown__item:visible")
    .filter({ hasText: formName })
    .first()
    .click();
}

test("表单数据：选表单浏览动态列 + 详情抽屉", async ({ page }) => {
  await login(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const { formPk, formName, deviceName, headers } = await createFormScene(
    page,
    suffix
  );

  try {
    await openFormDataPage(page, formName);
    const table = page.getByTestId("form-data-table");
    // 动态列：所选表单 schema 的字段 label 成为表头
    await expect(
      table.getByRole("columnheader", { name: "设备名称" })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      table.getByRole("columnheader", { name: "数量" })
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "启用" })
    ).toBeVisible();

    // 行数据：数字原样、开关转布尔文案（列表展示口径）
    const row = table.getByRole("row", { name: deviceName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText("3", { exact: true })).toBeVisible();
    await expect(row.getByText("是", { exact: true })).toBeVisible();

    // 详情抽屉：schema 快照渲染字段与值
    await row.getByTestId("form-data-detail").click();
    const detail = page.getByTestId("submission-detail-drawer");
    await expect(detail).toBeVisible({ timeout: 10_000 });
    await expect(detail).toContainText(deviceName);
    await page.keyboard.press("Escape");
    await expect(detail).not.toBeVisible();
  } finally {
    await page.request
      .delete(`${FRONT_URL}/api/dataset/dynamic-forms/${formPk}`, { headers })
      .catch(() => undefined);
  }
});

test("表单数据：按可筛选字段筛选列表", async ({ page }) => {
  await login(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const formName = `E2E筛选表单-${suffix}`;
  const deviceA = `E2E筛选路由器-A-${suffix}`;
  const deviceB = `E2E筛选路由器-B-${suffix}`;

  const formRes = await page.request.post(
    `${FRONT_URL}/api/dataset/dynamic-forms`,
    {
      headers,
      data: {
        name: formName,
        description: "E2E 物化筛选列",
        is_active: true,
        schema: {
          fields: [
            {
              key: "device",
              label: "设备名称",
              type: "input",
              required: true,
              filterable: true
            },
            { key: "count", label: "数量", type: "number" }
          ]
        }
      }
    }
  );
  expect(formRes.ok(), await formRes.text()).toBeTruthy();
  const formPk = (await formRes.json()).data.pk;
  for (const [device, count] of [
    [deviceA, 3],
    [deviceB, 5]
  ] as const) {
    const filled = await page.request.post(
      `${FRONT_URL}/api/dataset/dynamic-form-submissions`,
      { headers, data: { form: formPk, data: { device, count } } }
    );
    expect(filled.ok(), await filled.text()).toBeTruthy();
  }

  try {
    await openFormDataPage(page, formName);
    const table = page.getByTestId("form-data-table");
    await expect(table.getByRole("row", { name: deviceA })).toBeVisible({
      timeout: 15_000
    });
    await expect(table.getByRole("row", { name: deviceB })).toBeVisible();

    // 筛选框：设备名称 = A（回车触发查询；后端按物化筛选列过滤）
    const filterInput = page.getByTestId("form-data-filter-device");
    await filterInput.fill(deviceA);
    await filterInput.press("Enter");
    await expect(table.getByRole("row", { name: deviceB })).toHaveCount(0, {
      timeout: 15_000
    });
    await expect(table.getByRole("row", { name: deviceA })).toBeVisible();

    // 清空筛选恢复全量
    await page.getByRole("button", { name: "清空筛选" }).click();
    await expect(table.getByRole("row", { name: deviceB })).toBeVisible({
      timeout: 15_000
    });
  } finally {
    await page.request
      .delete(`${FRONT_URL}/api/dataset/dynamic-forms/${formPk}`, { headers })
      .catch(() => undefined);
  }
});

test("表单数据：选人字段按主键筛选（远程搜索）", async ({ page }) => {
  await login(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const formName = `E2E选人筛选-${suffix}`;
  const deviceA = `E2E选人路由器-A-${suffix}`;
  const deviceB = `E2E选人路由器-B-${suffix}`;

  // 选人筛选取值为用户主键：本用例用「当前用户」与种子账号各提交一条
  const meRes = await page.request.get(`${FRONT_URL}/api/system/userinfo`, {
    headers
  });
  expect(meRes.ok(), await meRes.text()).toBeTruthy();
  const me = (await meRes.json()).data;
  const otherRes = await page.request.get(
    `${FRONT_URL}/api/system/user?page=1&limit=10&username=e2e_user`,
    { headers }
  );
  const other = ((await otherRes.json())?.data?.results ?? []).find(
    (item: { username?: string }) => item.username === "e2e_user"
  );
  expect(other, "seed user e2e_user missing").toBeTruthy();

  const formRes = await page.request.post(
    `${FRONT_URL}/api/dataset/dynamic-forms`,
    {
      headers,
      data: {
        name: formName,
        description: "E2E 选人字段筛选",
        is_active: true,
        schema: {
          fields: [
            {
              key: "device",
              label: "设备名称",
              type: "input",
              required: true
            },
            {
              key: "owner",
              label: "负责人",
              type: "user",
              required: true,
              filterable: true
            }
          ]
        }
      }
    }
  );
  expect(formRes.ok(), await formRes.text()).toBeTruthy();
  const formPk = (await formRes.json()).data.pk;
  for (const [device, owner] of [
    [deviceA, me.pk],
    [deviceB, other.pk]
  ] as const) {
    const filled = await page.request.post(
      `${FRONT_URL}/api/dataset/dynamic-form-submissions`,
      { headers, data: { form: formPk, data: { device, owner } } }
    );
    expect(filled.ok(), await filled.text()).toBeTruthy();
  }

  try {
    await openFormDataPage(page, formName);
    const table = page.getByTestId("form-data-table");
    await expect(table.getByRole("row", { name: deviceA })).toBeVisible({
      timeout: 15_000
    });
    await expect(table.getByRole("row", { name: deviceB })).toBeVisible();

    // 选人筛选：远程搜索关键字 → 选中本人 → 后端按物化主键过滤
    await page.getByTestId("form-data-filter-owner").click();
    await page.keyboard.type(me.username);
    await page
      .locator(".el-popper:visible .el-select-dropdown__item")
      .filter({ hasText: me.username })
      .first()
      .click();
    await expect(table.getByRole("row", { name: deviceB })).toHaveCount(0, {
      timeout: 15_000
    });
    await expect(table.getByRole("row", { name: deviceA })).toBeVisible();

    // 清空筛选恢复全量
    await page.getByRole("button", { name: "清空筛选" }).click();
    await expect(table.getByRole("row", { name: deviceB })).toBeVisible({
      timeout: 15_000
    });
  } finally {
    await page.request
      .delete(`${FRONT_URL}/api/dataset/dynamic-forms/${formPk}`, { headers })
      .catch(() => undefined);
  }
});

test("表单数据：导出按所选表单出动态列文件", async ({ page }) => {
  // 高负载档放宽用例超时：下载等待已放宽到 DOWNLOAD_TIMEOUT
  if (HIGH_LOAD) test.slow();
  await login(page);
  const suffix = Math.random().toString(36).slice(2, 8);
  const { formPk, formName, deviceName, headers } = await createFormScene(
    page,
    suffix
  );

  try {
    await openFormDataPage(page, formName);
    const table = page.getByTestId("form-data-table");
    await expect(table.getByRole("row", { name: deviceName })).toBeVisible({
      timeout: 15_000
    });

    // 工具栏为图标按钮：按可访问名定位（同 import-export 口径）
    await table
      .locator("div.flex.mr-4")
      .first()
      .getByRole("button", { name: "导出", exact: true })
      .click();
    const dialog = page.locator(".el-dialog", { hasText: "导出" }).first();
    await expect(dialog).toBeVisible();

    const downloadPromise = page.waitForEvent("download", {
      timeout: DOWNLOAD_TIMEOUT
    });
    await dialog
      .getByRole("button", { name: /保存|确定/ })
      .first()
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    expect(statSync(filePath as string).size).toBeGreaterThan(1024);
  } finally {
    await page.request
      .delete(`${FRONT_URL}/api/dataset/dynamic-forms/${formPk}`, { headers })
      .catch(() => undefined);
  }
});
