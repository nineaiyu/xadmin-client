import { devices, expect, test, type Page } from "@playwright/test";

import { AesEncrypted } from "../src/utils/aes";

import {
  APPROVER,
  BACKEND_URL,
  FRONT_URL,
  getAccessToken,
  login
} from "./helpers";

/**
 * 移动端形态守护（P2.6）：iPhone 13 视口下的核心页可用性。
 *
 * 背景：`deviceDetection()` 走 UA 判定（`@pureadmin/utils`），命中的 UA 会进入
 * 「移动形态」——侧栏变成抽屉、页面按移动分支渲染（如用户管理改成上下堆叠）。
 * 本文件钉住两件事：
 *
 * 1. 核心页**无页面级横向溢出**（表格等在容器内横向滚动，不撑破页面）；
 * 2. 侧栏抽屉可用（汉堡 → 抽屉进入视口）；
 * 3. 用户管理堆叠布局里部门树**不得铺满视口**（否则用户列表被推到整屏之外，
 *    2026-09-27 实测缺陷，修复见 UserTree 的 compact 高度）；
 * 4. 移动审批最小操作面：审批中心待办在手机视口可完成通过/驳回（弹窗不出屏）。
 *
 * 仅 chromium：webkit 的 device emulation 在 CI 上与 playwright 版本耦合较紧，
 * 移动形态的判定逻辑与浏览器无关（UA 判定 + CSS 响应式）。
 */

const MOBILE_PAGES = [
  { name: "首页", hash: "/#/welcome" },
  { name: "用户管理", hash: "/#/system/user/index" },
  { name: "账户设置", hash: "/#/user/info/index" },
  { name: "我的填报", hash: "/#/form-collection/my/index" },
  { name: "聊天室", hash: "/#/chat/index" },
  { name: "仪表盘", hash: "/#/analysis/dashboard/index" }
];

test.use({ ...devices["iPhone 13"] });

test.describe("移动端形态（iPhone 13）", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "移动形态判定与浏览器无关，仅跑 chromium 控制成本"
  );

  test("核心页无横向溢出 + 侧栏抽屉可用 + 用户管理堆叠不遮挡列表", async ({
    page
  }) => {
    await login(page);

    for (const item of MOBILE_PAGES) {
      await page.goto(`${FRONT_URL}${item.hash}`);
      await expect(page.locator("body")).toBeVisible();
      // 页面级溢出：出现即说明某处宽度失控（如固定宽表格/弹窗没进滚动容器）
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow, `${item.name} 出现页面级横向溢出`).toBeLessThanOrEqual(
        1
      );
    }

    // 侧栏抽屉：默认在视口外（left < 0）→ 汉堡打开（left ≈ 0）→ 点遮罩收起
    await page.goto(`${FRONT_URL}/#/welcome`);
    const sidebar = page.locator(".sidebar-container");
    const closedBox = await sidebar.boundingBox();
    expect(closedBox?.x ?? 0).toBeLessThan(0);
    await page.locator(".hamburger-container").first().click();
    await expect
      .poll(async () => (await sidebar.boundingBox())?.x ?? -1, {
        timeout: 5_000
      })
      .toBeGreaterThanOrEqual(0);
    // 遮罩覆盖整屏，中心点落在抽屉上会被拦截：按坐标点右侧空白区
    await page.locator(".app-mask").click({ position: { x: 300, y: 300 } });
    await expect
      .poll(async () => (await sidebar.boundingBox())?.x ?? 0, {
        timeout: 5_000
      })
      .toBeLessThan(0);

    // 用户管理：部门树限高（不得占满视口），用户列表进入首屏
    await page.goto(`${FRONT_URL}/#/system/user/index`);
    // 只断言「有数据行」：不得钉具体行（xadmin 是最早创建的账号，共享库跑批后
    // 会被后建账号挤出第一页——列表断言陷阱，见 e2e/README 教训表）
    const userList = page.locator(".el-table__row").first();
    await expect(userList).toBeVisible({ timeout: 15_000 });
    const metrics = await page.evaluate(() => {
      const tree = document.querySelector(".el-tree");
      const table = document.querySelector(".el-table");
      return {
        viewportHeight: window.innerHeight,
        treeHeight: tree ? tree.getBoundingClientRect().height : 0,
        tableTop: table ? Math.round(table.getBoundingClientRect().top) : -1
      };
    });
    expect(metrics.treeHeight).toBeLessThan(metrics.viewportHeight / 2);
    expect(metrics.tableTop).toBeGreaterThan(0);
    expect(metrics.tableTop).toBeLessThan(metrics.viewportHeight);
  });

  test("移动端不渲染侧栏拖拽把手（桌面专属能力）", async ({ page }) => {
    await login(page);

    // 服务端直接打开拖拽开关：移动形态（UA 判定）下把手仍必须不渲染
    const listUrl = `${FRONT_URL}/api/system/config/system`;
    const readConfig = async () => {
      const resp = await page.request.get(`${listUrl}?key=WEB_SITE_CONFIG`);
      const rows = (await resp.json())?.data?.results ?? [];
      const row = Array.isArray(rows)
        ? rows.find((item: { key: string }) => item.key === "WEB_SITE_CONFIG")
        : undefined;
      return {
        pk: row?.pk as string,
        value:
          typeof row?.value === "string"
            ? (JSON.parse(row.value) as Record<string, unknown>)
            : ((row?.value ?? {}) as Record<string, unknown>)
      };
    };
    const writeDraggable = async (enabled: boolean) => {
      const { pk, value } = await readConfig();
      await page.request.patch(`${listUrl}/${pk}`, {
        data: { value: { ...value, SidebarDraggable: enabled } }
      });
    };

    await writeDraggable(true);
    try {
      await page.reload();
      await page
        .locator(".hamburger-container")
        .first()
        .waitFor({ timeout: 15_000 });
      // 开关已在服务端打开，移动形态下把手仍不进入 DOM
      await expect(page.locator(".sidebar-resizer")).toHaveCount(0);
      // 抽屉打开后同样不渲染
      await page.locator(".hamburger-container").first().click();
      await expect(page.locator(".sidebar-container")).toBeVisible();
      await expect(page.locator(".sidebar-resizer")).toHaveCount(0);
    } finally {
      await writeDraggable(false);
    }
  });
});

/**
 * 敏感操作审批拦截开关（与 approval.e2e.ts 同款口径）：用例内开启，finally 复位，
 * 不污染其他用例的删除链路。
 */
const APPROVAL_PATHS_CONFIG_PK = "e9a6b7c8-d9e0-4f1a-9b2c-3d4e5f6a7b0f";

async function setApprovalPaths(page: Page, token: string, paths: string[]) {
  // router 为 trailing_slash=False：detail 路由不能带尾斜杠（否则 Django 404 HTML 页）
  const response = await page.request.patch(
    `${BACKEND_URL}/api/system/config/system/${APPROVAL_PATHS_CONFIG_PK}`,
    { headers: { Authorization: `Bearer ${token}` }, data: { value: paths } }
  );
  expect(response.ok(), await response.text()).toBeTruthy();
}

/**
 * 移动审批最小操作面（7.4）：审批中心待办在手机视口完成 驳回 + 通过 全链路。
 *
 * 造单走 API（开启拦截后 DELETE 命中 412 建单，申请人 = xadmin），操作面走真实 UI：
 * 审批人（第二超管，申请人不能自审）另起 iPhone 13 视口上下文。
 * 弹窗宽度断言钉住全局窄屏钳制（`min(--el-dialog-width, 92vw)`）：固定 440px 的
 * 驳回弹窗在 390px 视口必须收敛进屏（否则关闭按钮出屏、操作面断裂）。
 */
test("移动审批操作面：待办列表无溢出 + 驳回弹窗在视口内 + 通过/驳回生效", async ({
  page,
  browser
}) => {
  const suffix = Date.now();
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };

  /** 开拦截后 API 删除新建用户 → 412 建单，返回单号（pk 前 8 位大写） */
  async function createPendingApproval(index: number) {
    const username = `e2e_mobile_${index}_${suffix}`;
    const created = await page.request.post(
      `${BACKEND_URL}/api/identity/user`,
      {
        headers,
        data: {
          username,
          nickname: username,
          password: await AesEncrypted(username, "E2E-Mobile-2026!")
        }
      }
    );
    const createdPayload = await created.json();
    const userPk = createdPayload?.data?.pk;
    expect(
      userPk,
      `create user: ${JSON.stringify(createdPayload)}`
    ).toBeTruthy();
    const denied = await page.request.delete(
      `${BACKEND_URL}/api/identity/user/${userPk}`,
      { headers }
    );
    expect(denied.status(), await denied.text()).toBe(412);
    const approvalId = (await denied.json())?.data?.approval_id;
    expect(approvalId).toBeTruthy();
    return String(approvalId).slice(0, 8).toUpperCase();
  }

  try {
    await setApprovalPaths(page, token, ["^/api/identity/user/[^/]+$"]);
    const rejectNo = await createPendingApproval(1);
    const approveNo = await createPendingApproval(2);

    // 审批人移动视口：审批中心待办页签
    const mobileContext = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL: FRONT_URL,
      locale: "zh-CN"
    });
    const mobile = await mobileContext.newPage();
    await login(mobile, APPROVER);
    await mobile.goto(`${FRONT_URL}/#/approval/index`);
    await expect(mobile.locator(".el-table").first()).toBeVisible({
      timeout: 15_000
    });
    // 页面级无横向溢出（与首个用例同口径：容器内滚动，不撑破页面）
    const overflow = await mobile.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow, "审批中心出现页面级横向溢出").toBeLessThanOrEqual(1);

    // 驳回：弹窗宽度必须在视口内（窄屏钳制守卫）→ 填原因 → 保存 → 行离开待办
    const rejectRow = mobile
      .locator(".el-table__row", { hasText: rejectNo })
      .first();
    await rejectRow.waitFor({ state: "visible", timeout: 15_000 });
    await rejectRow.getByRole("button", { name: "驳回" }).first().click();
    const dialog = mobile.locator(".el-dialog:visible").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const viewport = mobile.viewportSize()!;
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox, "驳回弹窗应有几何信息").not.toBeNull();
    expect(
      dialogBox!.width,
      `驳回弹窗宽度 ${dialogBox!.width} 必须在视口 ${viewport.width} 内`
    ).toBeLessThanOrEqual(viewport.width);
    await dialog.locator("textarea").first().fill("E2E 移动端驳回");
    await dialog
      .getByRole("button", { name: /保存|确定/ })
      .first()
      .click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
    await expect(rejectRow).toHaveCount(0, { timeout: 15_000 });

    // 通过：popconfirm 确认 → 行离开待办（申请人的删除随即真正执行）
    const approveRow = mobile
      .locator(".el-table__row", { hasText: approveNo })
      .first();
    await approveRow.waitFor({ state: "visible", timeout: 15_000 });
    await approveRow.getByRole("button", { name: "通过" }).first().click();
    await mobile
      .locator(".el-popconfirm, .el-popper, .el-message-box")
      .getByRole("button", { name: "确定" })
      .first()
      .click();
    await expect(approveRow).toHaveCount(0, { timeout: 15_000 });
    await mobileContext.close();
  } finally {
    // 复位拦截清单：其他用例的删除链路不依赖审批
    await setApprovalPaths(page, token, []).catch(() => undefined);
  }
});
