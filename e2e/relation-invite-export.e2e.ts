import { statSync } from "node:fs";

import { expect, test } from "@playwright/test";

import {
  BACKEND_URL,
  DOWNLOAD_TIMEOUT,
  getAccessToken,
  login,
  openMenuPath
} from "./helpers";

/**
 * 跨页联动与导出 E2E：
 *
 * 1. 关联计数声明式：角色列表「用户数」展示真实计数，点击跳转到按角色筛选的用户列表；
 * 2. 邀请开户：行操作「邀请激活」发送邀请后状态列变为「待接受邀请」；
 * 3. 图表导出：仪表盘卡片「导出图片」触发下载（PNG，SVG 回退），文件非空。
 *
 * 数据准备走 API（角色 / 用户 / 数据集 / 仪表盘），UI 只做展示与交互断言。
 */

const E2E_PASSWORD = "E2E@CrossPage2026x";

type ApiBody = {
  code: number;
  detail?: string;
  data?: { pk?: string };
};

test("角色列表用户数可点击，跳转到按角色筛选的用户列表", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Date.now();
  const roleName = `E2E计数角色${suffix}`;
  const usernames = [`e2e_cnt_${suffix}_0`, `e2e_cnt_${suffix}_1`];

  const roleResp = await page.request.post(`${BACKEND_URL}/api/system/role`, {
    headers,
    // fields 为字段权限地图（write_only 必填）：空对象 = 不设字段权限
    data: { name: roleName, code: `e2e_count_${suffix}`, fields: {} }
  });
  expect(roleResp.ok(), await roleResp.text()).toBeTruthy();
  const roleBody = (await roleResp.json()) as ApiBody;
  expect(roleBody.code, JSON.stringify(roleBody)).toBe(1000);
  const rolePk = roleBody.data?.pk ?? "";

  for (const username of usernames) {
    const userResp = await page.request.post(`${BACKEND_URL}/api/system/user`, {
      headers,
      data: { username, password: E2E_PASSWORD, nickname: username }
    });
    expect(userResp.ok(), await userResp.text()).toBeTruthy();
    const userBody = (await userResp.json()) as ApiBody;
    expect(userBody.code, JSON.stringify(userBody)).toBe(1000);
    const userPk = userBody.data?.pk ?? "";
    const bindResp = await page.request.patch(
      `${BACKEND_URL}/api/system/user/${userPk}`,
      { headers, data: { roles: [rolePk] } }
    );
    expect(bindResp.ok(), await bindResp.text()).toBeTruthy();
  }

  await openMenuPath(page, ["系统管理", "权限管理"], "/system/role/index");
  const row = page.locator(".el-table__row", { hasText: roleName }).first();
  await row.waitFor({ state: "visible", timeout: 20_000 });

  // 用户数列（关联计数）渲染为可点击链接
  const countLink = row.locator("a.el-link", { hasText: /^2$/ }).first();
  await expect(countLink).toBeVisible({ timeout: 20_000 });
  await countLink.click();

  await page.waitForURL(/\/system\/user\/index\?role=/, { timeout: 20_000 });
  await expect(
    page.locator(".el-table__row", { hasText: usernames[0] }).first()
  ).toBeVisible({ timeout: 20_000 });
});

test("邀请激活：发送邀请后状态列显示待接受", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Date.now();
  const username = `e2e_invite_${suffix}`;

  const userResp = await page.request.post(`${BACKEND_URL}/api/system/user`, {
    headers,
    data: {
      username,
      password: E2E_PASSWORD,
      nickname: username,
      email: `invite_${suffix}@example.com`
    }
  });
  expect(userResp.ok(), await userResp.text()).toBeTruthy();
  const userBody = (await userResp.json()) as ApiBody;
  expect(userBody.code, JSON.stringify(userBody)).toBe(1000);

  await openMenuPath(page, ["系统管理"], "/system/user/index");
  const row = page.locator(".el-table__row", { hasText: username }).first();
  await row.waitFor({ state: "visible", timeout: 20_000 });

  // 用户行操作按钮超过 showNumber（3）会折叠进「更多」下拉
  const inviteText = row.getByText("邀请激活", { exact: true });
  if (await inviteText.isVisible().catch(() => false)) {
    await inviteText.click();
  } else {
    await row.getByRole("button", { name: "更多" }).click();
    await page
      .locator(".el-dropdown-menu:visible")
      .getByText("邀请激活", { exact: true })
      .click();
  }

  // 二次确认（重发会让原密码立即失效）
  await page.locator(".el-message-box__btns .el-button--primary").click();
  await expect(row.locator(".el-tag", { hasText: "待接受邀请" })).toBeVisible({
    timeout: 20_000
  });
});

test("仪表盘卡片导出图片触发下载且文件非空", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Date.now();
  const datasetName = `E2E导出数据集${suffix}`;
  const dashboardName = `E2E导出看板${suffix}`;
  const cardTitle = `E2E导出卡片${suffix}`;

  // 数据集（绑定系统用户，按性别分组计数）→ 仪表盘（内嵌柱状图卡片）
  const dsResp = await page.request.post(`${BACKEND_URL}/api/system/datasets`, {
    headers,
    data: {
      name: datasetName,
      bound_model: "system.userinfo",
      columns: ["username"]
    }
  });
  expect(dsResp.ok(), await dsResp.text()).toBeTruthy();
  const dsBody = (await dsResp.json()) as ApiBody;
  expect(dsBody.code, JSON.stringify(dsBody)).toBe(1000);
  const datasetPk = dsBody.data?.pk ?? "";

  const dashResp = await page.request.post(
    `${BACKEND_URL}/api/system/dashboards`,
    {
      headers,
      data: {
        name: dashboardName,
        visibility: "shared",
        layout: [
          {
            id: `card-${suffix}`,
            dataset: datasetPk,
            title: cardTitle,
            chart_type: "bar",
            group_by: "gender",
            metric: "count",
            span: 6,
            height: 224
          }
        ]
      }
    }
  );
  expect(dashResp.ok(), await dashResp.text()).toBeTruthy();
  const dashBody = (await dashResp.json()) as ApiBody;
  expect(dashBody.code, JSON.stringify(dashBody)).toBe(1000);
  const dashboardPk = dashBody.data?.pk ?? "";

  // 分享链接参数 ?pk= 直接定位该仪表盘（hash 路由整页跳转）
  await page.goto(`/#/analysis/dashboard/index?pk=${dashboardPk}`);
  const cardTitleNode = page.getByText(cardTitle).first();
  await expect(cardTitleNode).toBeVisible({ timeout: 20_000 });

  const exportBtn = page.locator('[data-testid="card-export-image"]').first();
  await expect(exportBtn).toBeVisible({ timeout: 20_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: DOWNLOAD_TIMEOUT }),
    exportBtn.click()
  ]);
  // 项目 ECharts 为 SVGRenderer：优先转 PNG，浏览器受限时回退 SVG 原图
  expect(download.suggestedFilename()).toMatch(/\.(png|svg)$/);
  const filePath = await download.path();
  expect(filePath, "download path should exist").toBeTruthy();
  expect(statSync(filePath as string).size).toBeGreaterThan(500);
});
