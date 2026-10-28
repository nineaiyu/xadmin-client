import { expect, test, type Page } from "@playwright/test";

import {
  BACKEND_URL,
  FRONT_URL,
  getAccessToken,
  login,
  openMenuPath
} from "./helpers";

/**
 * 数据集 + 仪表盘主链路：
 * 建数据集（绑定 identity.userinfo）→ 建仪表盘 → 添加数字卡片 → 保存布局 →
 * 卡片标题与统计渲染。聚合图表由后端集成测试覆盖数据形态，E2E 走 UI 链路。
 */

const pickSelectOption = async (
  page: Page,
  formLabel: string,
  optionText: string
) => {
  await page
    .locator(`.el-dialog .el-form-item:has-text('${formLabel}') .el-select`)
    .first()
    .click();
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
      hasText: optionText
    })
    .first()
    .click();
};

test("数据集 + 仪表盘主链路", async ({ page }) => {
  await login(page);

  // 名称唯一约束（Dataset/Dashboard.name unique）+ 双浏览器共享同一独立库：
  // 固定名字会让后跑的浏览器撞唯一约束（曾表现为 webkit 稳定失败、隔离复跑才过），
  // 统一加随机后缀防冲突（e2e/README「历史教训速查」同款处置）
  const suffix = Math.random().toString(36).slice(2, 8);
  const datasetName = `E2E数据集-${suffix}`;
  const dashboardName = `E2E看板-${suffix}`;

  // ---- 建数据集 ----
  await openMenuPath(page, ["数据分析"], "/analysis/dataset/index");
  // RePlusPage 列表以工具栏按钮为加载锚点（表格行需等种子/新建数据）
  await expect(page.getByRole("button", { name: "新建数据集" })).toBeVisible({
    timeout: 15_000
  });

  await page.getByRole("button", { name: "新建数据集" }).click();
  const dialog = page.locator(".el-dialog").filter({ hasText: "新建数据集" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("名称").fill(datasetName);
  await pickSelectOption(page, "绑定模型", "identity.userinfo");
  await pickSelectOption(page, "数据列", "username");
  // 弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("row", { name: datasetName }).first()
  ).toBeVisible({ timeout: 15_000 });

  // ---- 建仪表盘并加卡片 ----
  await openMenuPath(page, ["数据分析"], "/analysis/dashboard/index");
  await page.getByRole("button", { name: "新建仪表盘" }).first().click();
  const dashDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "新建仪表盘" });
  await dashDialog.getByLabel("仪表盘名称").fill(dashboardName);
  // 弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await dashDialog.getByRole("button", { name: "保存" }).click();
  await expect(dashDialog).not.toBeVisible();

  await page.getByRole("button", { name: "编辑布局" }).click();
  await page.getByRole("button", { name: "添加卡片" }).click();
  const cardDialog = page.locator(".el-dialog").filter({ hasText: "添加卡片" });
  await expect(cardDialog).toBeVisible();
  await pickSelectOption(page, "数据集", datasetName);
  // EP 的单选下拉在选中后并不真正收起（残留 DOM 且拦截后续点击，见 e2e/README），
  // 点弹窗空白头部（下拉上方，不会被其遮挡）触发外部点击收起
  await cardDialog.locator(".el-dialog__header").click();
  await cardDialog.getByLabel("卡片标题").fill("用户总数");
  // 卡片授权面——选一个「可见角色」（多选下拉不自动收起，同样需手动收起）。
  // EP 收起后的下拉仍以可见态残留在 DOM，必须经 aria-controls 精确锁定本下拉的列表
  const rolesSelect = cardDialog
    .locator(".el-form-item")
    .filter({ hasText: "可见角色" })
    .locator(".el-select");
  await rolesSelect.click();
  const rolesCombo = cardDialog.getByRole("combobox", { name: "可见角色" });
  const rolesListId = await rolesCombo.getAttribute("aria-controls");
  expect(rolesListId).not.toBeNull();
  const roleItem = page
    .locator(`[id="${rolesListId}"] .el-select-dropdown__item`)
    .last();
  await expect(roleItem).toBeVisible();
  const roleName = ((await roleItem.textContent()) ?? "").trim();
  expect(roleName).not.toBe("");
  await roleItem.click();
  await expect(rolesSelect.locator(".el-tag").first()).toContainText(roleName);
  await cardDialog.locator(".el-dialog__header").click();
  await cardDialog.getByRole("button", { name: "保存" }).click();
  await expect(cardDialog).not.toBeVisible();

  // 重开卡片设置验证「可见角色」回显（读内存草稿，无需先保存布局；
  // 放在保存布局之前——保存后 dashboards 数组整行替换会重建卡片按钮导致 detached 抖动）
  const card = page.locator(".el-card").filter({ hasText: "用户总数" });
  await expect(card).toBeVisible();
  await card.getByTitle("卡片设置").click();
  const editCardDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "编辑卡片" });
  await expect(editCardDialog).toBeVisible();
  await expect(
    editCardDialog.locator(".el-select").filter({ hasText: roleName }).first()
  ).toBeVisible();
  await editCardDialog.getByRole("button", { name: "关闭此对话框" }).click();
  await expect(editCardDialog).not.toBeVisible();

  await page.getByRole("button", { name: "保存布局" }).click();
  await expect(page.getByText("保存成功").first()).toBeVisible();
  // 卡片渲染：标题 + 数字卡内容（total 为系统用户数，E2E 种子环境 > 0）
  await expect(card).toBeVisible();
  await expect(card.locator(".text-3xl")).toHaveText(/\d+/);

  // 卡片宽度档位是 12 栅格（默认 6 → 6/12），渲染到 el-col 需换算为 24 栅格：
  // 默认半宽 ≈ 0.5（曾直接透传导致实渲染只有标称一半，见 views/dashboard/utils/span.ts）
  const rowBox = await page.getByTestId("dashboard-cards").boundingBox();
  const colBox = await page
    .getByTestId("dashboard-cards")
    .locator(".el-col")
    .first()
    .boundingBox();
  const ratio = (colBox?.width ?? 0) / (rowBox?.width ?? 1);
  expect(ratio).toBeGreaterThan(0.4);
  expect(ratio).toBeLessThan(0.6);
});

test("仪表盘快照导出：整盘卡片合成单张 PNG 长图下载", async ({ page }) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Math.random().toString(36).slice(2, 8);
  const datasetName = `E2E快照集-${suffix}`;
  const dashboardName = `E2E快照板-${suffix}`;
  let datasetPk = "";
  let dashboardPk = "";

  try {
    const dsRes = await page.request.post(
      `${BACKEND_URL}/api/dataset/datasets`,
      {
        headers,
        data: {
          name: datasetName,
          bound_model: "approval.leave",
          columns: ["days", "leave_type"],
          row_limit: 100,
          visibility: "shared"
        }
      }
    );
    expect(dsRes.ok(), await dsRes.text()).toBeTruthy();
    datasetPk = (await dsRes.json()).data.pk;

    // 布局直建一张柱状图卡（API 直建免走编辑弹窗，聚焦导出链路）
    const dbRes = await page.request.post(
      `${BACKEND_URL}/api/dataset/dashboards`,
      {
        headers,
        data: {
          name: dashboardName,
          visibility: "shared",
          layout: [
            {
              id: `e2e-snap-${suffix}`,
              dataset: datasetPk,
              title: `快照卡-${suffix}`,
              chart_type: "bar",
              group_by: "leave_type",
              metric: "count"
            }
          ]
        }
      }
    );
    expect(dbRes.ok(), await dbRes.text()).toBeTruthy();
    dashboardPk = (await dbRes.json()).data.pk;

    await page.goto(`${FRONT_URL}/#/analysis/dashboard/index`);
    await page
      .locator(".el-card")
      .first()
      .locator(".el-select")
      .first()
      .click();
    await page
      .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
        hasText: dashboardName
      })
      .first()
      .click();
    // 图表渲染完成再合成（骨架期导出会拿到空图）
    const card = page
      .locator(".el-card")
      .filter({ hasText: `快照卡-${suffix}` });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.locator("svg").first()).toBeVisible({ timeout: 15_000 });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("dashboard-export-snapshot").click()
    ]);
    expect(download.suggestedFilename()).toMatch(/-snapshot\.png$/);
  } finally {
    if (dashboardPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/dataset/dashboards/${dashboardPk}`, {
          headers
        })
        .catch(() => undefined);
    }
    if (datasetPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/dataset/datasets/${datasetPk}`, {
          headers
        })
        .catch(() => undefined);
    }
  }
});

test("仪表盘卡片下钻：图表点击维度过滤明细，可清过滤看全量", async ({
  page
}) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Math.random().toString(36).slice(2, 8);
  const datasetName = `E2E下钻集-${suffix}`;
  const dashboardName = `E2E下钻板-${suffix}`;
  let datasetPk = "";
  let dashboardPk = "";
  const bookPks: string[] = [];

  try {
    // E2E 库无业务行：自建两本书（category 0=小说 / 1=文学）保证命中与过滤可断言；
    // Book 的 admin/admin2 为必填外键，取超管自身 pk
    const meRes = await page.request.get(
      `${BACKEND_URL}/api/identity/user?username=xadmin`,
      { headers }
    );
    const adminPk = (await meRes.json()).data.results[0].pk;
    for (const [name, category] of [
      [`E2E下钻小说-${suffix}`, 0],
      [`E2E下钻文学-${suffix}`, 1]
    ] as const) {
      const res = await page.request.post(`${BACKEND_URL}/api/demo/book`, {
        headers,
        data: {
          name,
          category,
          admin: adminPk,
          admin2: adminPk,
          // serializer 必填面（模型层 blank=True 但 DRF m2m/char 默认 required）
          isbn: `ISBN-${suffix}-${category}`,
          author: "E2E",
          managers: [adminPk]
        }
      });
      expect(res.ok(), await res.text()).toBeTruthy();
      bookPks.push((await res.json()).data.pk);
    }

    const dsRes = await page.request.post(
      `${BACKEND_URL}/api/dataset/datasets`,
      {
        headers,
        data: {
          name: datasetName,
          bound_model: "demo.book",
          columns: ["name", "category"],
          row_limit: 100,
          visibility: "shared"
        }
      }
    );
    expect(dsRes.ok(), await dsRes.text()).toBeTruthy();
    datasetPk = (await dsRes.json()).data.pk;

    const dbRes = await page.request.post(
      `${BACKEND_URL}/api/dataset/dashboards`,
      {
        headers,
        data: {
          name: dashboardName,
          visibility: "shared",
          layout: [
            {
              id: `e2e-drill-${suffix}`,
              dataset: datasetPk,
              title: `下钻卡-${suffix}`,
              chart_type: "bar",
              group_by: "category",
              metric: "count"
            }
          ]
        }
      }
    );
    expect(dbRes.ok(), await dbRes.text()).toBeTruthy();
    dashboardPk = (await dbRes.json()).data.pk;

    await page.goto(`${FRONT_URL}/#/analysis/dashboard/index`);
    await page
      .locator(".el-card")
      .first()
      .locator(".el-select")
      .first()
      .click();
    await page
      .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
        hasText: dashboardName
      })
      .first()
      .click();
    const card = page
      .locator(".el-card")
      .filter({ hasText: `下钻卡-${suffix}` });
    await expect(card).toBeVisible({ timeout: 15_000 });
    // echarts 主图 = 卡内最后一个 svg（header 按钮的图标 svg 在前）
    await expect(card.locator("svg").last()).toBeVisible({ timeout: 15_000 });

    // 查看明细按钮：全量抽屉（两本书均在，无过滤提示条）
    await card.getByTestId("card-drill-open").click();
    const drawer = page.locator(".el-drawer:visible").first();
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    await expect(drawer.getByTestId("card-drill-drawer")).toBeVisible();
    await expect(drawer.locator(".el-table__row")).toHaveCount(2, {
      timeout: 15_000
    });
    await expect(drawer.getByTestId("card-drill-filter")).toHaveCount(0);

    // 图表点击柱体：按维度原始值（category 的 raw 0/1）过滤到该类一本书
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden({ timeout: 15_000 });
    // 柱体 = 主图内带 fill 且有面积（>20px）的 path（legend 圆点仅 10px，
    // DOM 顺序不稳定不能按 first 命中）；取视口坐标后真实鼠标点击（zrender 代理）
    const barPoint = await card
      .locator("svg")
      .last()
      .evaluate((svg: SVGElement) => {
        const bars = Array.from(
          svg.querySelectorAll('path[fill]:not([fill="none"])')
        ).filter(element => {
          const box = element.getBoundingClientRect();
          return box.width > 20 && box.height > 20;
        });
        const box = bars[0].getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      });
    await page.mouse.click(barPoint.x, barPoint.y);
    const drillDrawer = page.locator(".el-drawer:visible").first();
    await expect(drillDrawer).toBeVisible({ timeout: 15_000 });
    await expect(drillDrawer.getByTestId("card-drill-filter")).toBeVisible();
    await expect(drillDrawer.locator(".el-table__row")).toHaveCount(1, {
      timeout: 15_000
    });

    // 清过滤：回到全量两行（过滤提示条消失）
    await drillDrawer.getByRole("button", { name: "查看全量" }).click();
    await expect(drillDrawer.getByTestId("card-drill-filter")).toHaveCount(0, {
      timeout: 15_000
    });
    await expect(drillDrawer.locator(".el-table__row")).toHaveCount(2, {
      timeout: 15_000
    });
  } finally {
    for (const pk of bookPks) {
      await page.request
        .delete(`${BACKEND_URL}/api/demo/book/${pk}`, { headers })
        .catch(() => undefined);
    }
    if (dashboardPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/dataset/dashboards/${dashboardPk}`, {
          headers
        })
        .catch(() => undefined);
    }
    if (datasetPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/dataset/datasets/${datasetPk}`, {
          headers
        })
        .catch(() => undefined);
    }
  }
});

test("仪表盘聚合卡片：度量字段（sum）可配置并真实渲染，支持刷新与设置", async ({
  page
}) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Math.random().toString(36).slice(2, 8);
  const datasetName = `E2E度量集-${suffix}`;
  const dashboardName = `E2E度量板-${suffix}`;
  const renamed = `${dashboardName}-改名`;
  let datasetPk = "";
  let dashboardPk = "";

  try {
    // 数值列 days 用于 sum 度量；leave_type 作为分组列
    // （白名单模型来自 ModelLabelField DATA 根节点；leave 已随 3.1 拆分迁至 approval app）
    const dsRes = await page.request.post(
      `${BACKEND_URL}/api/dataset/datasets`,
      {
        headers,
        data: {
          name: datasetName,
          bound_model: "approval.leave",
          columns: ["days", "leave_type"],
          row_limit: 100,
          visibility: "shared"
        }
      }
    );
    expect(dsRes.ok(), await dsRes.text()).toBeTruthy();
    datasetPk = (await dsRes.json()).data.pk;

    const dbRes = await page.request.post(
      `${BACKEND_URL}/api/dataset/dashboards`,
      {
        headers,
        data: { name: dashboardName, visibility: "shared", layout: [] }
      }
    );
    expect(dbRes.ok(), await dbRes.text()).toBeTruthy();
    dashboardPk = (await dbRes.json()).data.pk;

    await page.goto(`${FRONT_URL}/#/analysis/dashboard/index`);
    await page
      .locator(".el-card")
      .first()
      .locator(".el-select")
      .first()
      .click();
    await page
      .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
        hasText: dashboardName
      })
      .first()
      .click();

    await page.getByRole("button", { name: "编辑布局" }).click();
    await page.getByRole("button", { name: "添加卡片" }).click();
    const cardDialog = page
      .locator(".el-dialog")
      .filter({ hasText: "添加卡片" });
    await expect(cardDialog).toBeVisible();
    await pickSelectOption(page, "数据集", datasetName);
    await cardDialog.locator(".el-dialog__header").click();
    await cardDialog.getByLabel("卡片标题").fill("用户名ID求和");
    await pickSelectOption(page, "图表类型", "柱状图");
    await pickSelectOption(page, "分组字段", "leave_type");
    await pickSelectOption(page, "聚合方式", "求和");
    // sum/avg 的度量字段选择器（此前缺失 → 卡片必失败）：候选来自数据集数值列
    await pickSelectOption(page, "度量字段", "days");
    await cardDialog.locator(".el-dialog__header").click();
    await cardDialog.getByRole("button", { name: "保存" }).click();
    await expect(cardDialog).not.toBeVisible();

    await page.getByRole("button", { name: "保存布局" }).click();
    await expect(page.getByText("保存成功").first()).toBeVisible();

    // 图表真实渲染（svg）且无错误提示
    const card = page.locator(".el-card").filter({ hasText: "用户名ID求和" });
    await expect(card).toBeVisible();
    await expect(card.locator("svg").first()).toBeVisible({ timeout: 15_000 });
    await expect(card.getByTestId("chart-card-error")).toHaveCount(0);

    // 手动刷新：重挂载并重新拉数，不出现错误提示
    await page.getByTestId("dashboard-refresh").click();
    await expect(
      page.locator(".el-card").filter({ hasText: "用户名ID求和" })
    ).toBeVisible();
    await expect(
      page
        .locator(".el-card")
        .filter({ hasText: "用户名ID求和" })
        .getByTestId("chart-card-error")
    ).toHaveCount(0, { timeout: 15_000 });

    // 设置：重命名 + 可见性（此前 UI 无入口）
    await page.getByTestId("dashboard-settings").click();
    const settingsDialog = page
      .locator(".el-dialog")
      .filter({ hasText: "设置" });
    await expect(settingsDialog).toBeVisible();
    await settingsDialog.getByLabel("仪表盘名称").fill(renamed);
    await settingsDialog.getByRole("button", { name: "保存" }).click();
    await expect(settingsDialog).not.toBeVisible();
    // EP select 的选中值渲染为文本节点（filterable 模式下 input 不承载 label）
    await expect(
      page.locator(".el-card").first().locator(".el-select").first()
    ).toContainText(renamed, { timeout: 15_000 });
  } finally {
    if (dashboardPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/dataset/dashboards/${dashboardPk}`, {
          headers
        })
        .catch(() => undefined);
    }
    if (datasetPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/dataset/datasets/${datasetPk}`, {
          headers
        })
        .catch(() => undefined);
    }
  }
});

test("仪表盘卡片联动：点击维度值反向过滤其他卡片，chip 可清除", async ({
  page
}) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Math.random().toString(36).slice(2, 8);
  const datasetName = `E2E联动集-${suffix}`;
  const dashboardName = `E2E联动板-${suffix}`;
  let datasetPk = "";
  let dashboardPk = "";
  const bookPks: string[] = [];

  try {
    // 与下钻用例同口径：自建两本书（category 0=小说 / 1=文学）保证过滤可断言
    const meRes = await page.request.get(
      `${BACKEND_URL}/api/identity/user?username=xadmin`,
      { headers }
    );
    const adminPk = (await meRes.json()).data.results[0].pk;
    for (const [name, category] of [
      [`E2E联动小说-${suffix}`, 0],
      [`E2E联动文学-${suffix}`, 1]
    ] as const) {
      const res = await page.request.post(`${BACKEND_URL}/api/demo/book`, {
        headers,
        data: {
          name,
          category,
          admin: adminPk,
          admin2: adminPk,
          isbn: `ISBN-${suffix}-${category}`,
          author: "E2E",
          managers: [adminPk]
        }
      });
      expect(res.ok(), await res.text()).toBeTruthy();
      bookPks.push((await res.json()).data.pk);
    }

    const dsRes = await page.request.post(
      `${BACKEND_URL}/api/dataset/datasets`,
      {
        headers,
        data: {
          name: datasetName,
          bound_model: "demo.book",
          columns: ["name", "category"],
          row_limit: 100,
          visibility: "shared"
        }
      }
    );
    expect(dsRes.ok(), await dsRes.text()).toBeTruthy();
    datasetPk = (await dsRes.json()).data.pk;

    // 两张卡绑同一数据集：柱卡（来源）+ 数字卡（联动目标）
    const dbRes = await page.request.post(
      `${BACKEND_URL}/api/dataset/dashboards`,
      {
        headers,
        data: {
          name: dashboardName,
          visibility: "shared",
          layout: [
            {
              id: `e2e-link-bar-${suffix}`,
              dataset: datasetPk,
              title: `联动柱卡-${suffix}`,
              chart_type: "bar",
              group_by: "category",
              metric: "count"
            },
            {
              id: `e2e-link-num-${suffix}`,
              dataset: datasetPk,
              title: `联动数卡-${suffix}`,
              chart_type: "number"
            }
          ]
        }
      }
    );
    expect(dbRes.ok(), await dbRes.text()).toBeTruthy();
    dashboardPk = (await dbRes.json()).data.pk;

    await page.goto(`${FRONT_URL}/#/analysis/dashboard/index`);
    await page
      .locator(".el-card")
      .first()
      .locator(".el-select")
      .first()
      .click();
    await page
      .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
        hasText: dashboardName
      })
      .first()
      .click();

    const numberCard = page
      .locator(".el-card")
      .filter({ hasText: `联动数卡-${suffix}` });
    const barCard = page
      .locator(".el-card")
      .filter({ hasText: `联动柱卡-${suffix}` });
    await expect(barCard.locator("svg").last()).toBeVisible({
      timeout: 15_000
    });
    await expect(numberCard.locator(".text-3xl")).toHaveText("2", {
      timeout: 15_000
    });

    // 点击柱体：伴生下钻抽屉先出现；Esc 关闭后验证联动面（chip + 数字卡收敛到 1）
    // 柱体命中靠像素坐标（图表在重负载下会重排/重绘）：坐标测量与点击一起重试，
    // 以「抽屉真的出现」为收敛条件，避免图表位移导致的假失败
    const drawer = page.locator(".el-drawer:visible").first();
    await expect(async () => {
      const barPoint = await barCard
        .locator("svg")
        .last()
        .evaluate((svg: SVGElement) => {
          const bars = Array.from(
            svg.querySelectorAll('path[fill]:not([fill="none"])')
          ).filter(element => {
            const box = element.getBoundingClientRect();
            return box.width > 20 && box.height > 20;
          });
          const box = bars[0].getBoundingClientRect();
          return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        });
      await page.mouse.click(barPoint.x, barPoint.y);
      await expect(drawer).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId("dashboard-linkage-chip")).toBeVisible();
    await expect(numberCard.locator(".text-3xl")).toHaveText("1", {
      timeout: 15_000
    });

    // 清除联动：数字卡回到全量 2，chip 消失
    await page
      .getByTestId("dashboard-linkage-chip")
      .locator(".el-tag__close")
      .click();
    await expect(page.getByTestId("dashboard-linkage-chip")).toHaveCount(0, {
      timeout: 15_000
    });
    await expect(numberCard.locator(".text-3xl")).toHaveText("2", {
      timeout: 15_000
    });
  } finally {
    for (const pk of bookPks) {
      await page.request
        .delete(`${BACKEND_URL}/api/demo/book/${pk}`, { headers })
        .catch(() => undefined);
    }
    if (dashboardPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/dataset/dashboards/${dashboardPk}`, {
          headers
        })
        .catch(() => undefined);
    }
    if (datasetPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/dataset/datasets/${datasetPk}`, {
          headers
        })
        .catch(() => undefined);
    }
  }
});

test("仪表盘实时推送：实时档建立 ws/dashboard 连接并收到首帧", async ({
  page
}) => {
  await login(page);
  const token = await getAccessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = Math.random().toString(36).slice(2, 8);
  const datasetName = `E2E推送集-${suffix}`;
  const dashboardName = `E2E推送板-${suffix}`;
  let datasetPk = "";
  let dashboardPk = "";

  try {
    const dsRes = await page.request.post(
      `${BACKEND_URL}/api/dataset/datasets`,
      {
        headers,
        data: {
          name: datasetName,
          bound_model: "identity.userinfo",
          columns: ["username"],
          row_limit: 100,
          visibility: "shared"
        }
      }
    );
    expect(dsRes.ok(), await dsRes.text()).toBeTruthy();
    datasetPk = (await dsRes.json()).data.pk;

    const dbRes = await page.request.post(
      `${BACKEND_URL}/api/dataset/dashboards`,
      {
        headers,
        data: {
          name: dashboardName,
          visibility: "shared",
          layout: [
            {
              id: `e2e-rt-num-${suffix}`,
              dataset: datasetPk,
              title: `推送数卡-${suffix}`,
              chart_type: "number"
            }
          ]
        }
      }
    );
    expect(dbRes.ok(), await dbRes.text()).toBeTruthy();
    dashboardPk = (await dbRes.json()).data.pk;

    await page.goto(`${FRONT_URL}/#/analysis/dashboard/index`);
    await page
      .locator(".el-card")
      .first()
      .locator(".el-select")
      .first()
      .click();
    await page
      .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
        hasText: dashboardName
      })
      .first()
      .click();

    // 切到「实时（推送）」档：页面应建立 ws/dashboard/<pk> 连接（服务端按观察者
    // 权限聚合，连接即自推首帧——权限语义与逐卡 HTTP 重拉等价）
    const wsPromise = page.waitForEvent("websocket", ws =>
      ws.url().includes("/ws/dashboard/")
    );
    await page.getByTestId("dashboard-auto-refresh").click();
    await page
      .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
        hasText: "实时"
      })
      .first()
      .click();
    const ws = await wsPromise;

    const framePromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("no dashboard_data frame in 15s")),
        15_000
      );
      ws.on("framereceived", frame => {
        const payload =
          typeof frame.payload === "string"
            ? frame.payload
            : String(frame.payload ?? "");
        if (payload.includes("dashboard_data")) {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });
    const payload = await framePromise;
    expect(payload).toContain('"dashboard"');
    expect(payload).toContain('"cards"');
  } finally {
    if (dashboardPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/dataset/dashboards/${dashboardPk}`, {
          headers
        })
        .catch(() => undefined);
    }
    if (datasetPk) {
      await page.request
        .delete(`${BACKEND_URL}/api/dataset/datasets/${datasetPk}`, {
          headers
        })
        .catch(() => undefined);
    }
  }
});
