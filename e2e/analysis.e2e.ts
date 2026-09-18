import { expect, test, type Page } from "@playwright/test";

import { FRONT_URL, getAccessToken, login, openMenuPath } from "./helpers";

/**
 * 数据分析二期主链路：
 * 建数据集 → 建看板+卡片（投屏素材）→ 建报表并立即运行（状态落 SUCCESS*，
 * 邮件后端缺失时走 SUCCESS_WITH_DELIVERY_ERROR 降级）→ 建大屏并投屏（全屏页渲染卡片）；
 * 远程控制：管理端下发切换指令，展示端（第二标签页）经 ws/screen 实时跟随。
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

/** 多选下拉：连续点多个选项后点标题收起（el-select multiple 不自动关闭） */
const pickMultiSelectOptions = async (
  page: Page,
  dialog: ReturnType<Page["locator"]>,
  formLabel: string,
  optionTexts: string[]
) => {
  await dialog
    .locator(`.el-form-item:has-text('${formLabel}') .el-select`)
    .first()
    .click();
  for (const text of optionTexts) {
    await page
      .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
        hasText: text
      })
      .first()
      .click();
  }
  await dialog.locator(".el-dialog__header").click();
  await page
    .locator(".el-select-dropdown:visible")
    .waitFor({ state: "hidden", timeout: 5_000 })
    .catch(() => undefined);
};

test("报表与大屏主链路", async ({ page }) => {
  await login(page);

  // 名称唯一约束（Dataset/Dashboard/Report/Screen.name unique）+ 双浏览器共享同一
  // sqlite 库：固定名字会让后跑的浏览器撞唯一约束（曾表现为 webkit 稳定失败、隔离
  // 复跑才过），统一加随机后缀防冲突（e2e/README「历史教训速查」同款处置）
  const suffix = Math.random().toString(36).slice(2, 8);
  const datasetName = `E2E报表数据集-${suffix}`;
  const dashboardName = `E2E投屏看板-${suffix}`;
  const reportName = `E2E日报-${suffix}`;
  const screenName = `E2E大屏-${suffix}`;

  // ---- 素材：数据集 ----
  await openMenuPath(page, ["数据分析"], "/analysis/dataset/index");
  // RePlusPage 列表以工具栏按钮为加载锚点（表格行需等种子/新建数据）
  await expect(page.getByRole("button", { name: "新建数据集" })).toBeVisible({
    timeout: 15_000
  });
  await page.getByRole("button", { name: "新建数据集" }).click();
  const dsDialog = page.locator(".el-dialog").filter({ hasText: "新建数据集" });
  await dsDialog.getByLabel("名称").fill(datasetName);
  await pickSelectOption(page, "绑定模型", "system.userinfo");
  await pickSelectOption(page, "数据列", "username");
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await dsDialog.getByRole("button", { name: "保存" }).click();
  await expect(dsDialog).not.toBeVisible();

  // ---- 素材：看板 + 数字卡片 ----
  await openMenuPath(page, ["数据分析"], "/analysis/dashboard/index");
  await page.getByRole("button", { name: "新建仪表盘" }).first().click();
  const dashDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "新建仪表盘" });
  await dashDialog.getByLabel("仪表盘名称").fill(dashboardName);
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await dashDialog.getByRole("button", { name: "保存" }).click();
  await expect(dashDialog).not.toBeVisible();
  await page.getByRole("button", { name: "编辑布局" }).click();
  await page.getByRole("button", { name: "添加卡片" }).click();
  const cardDialog = page.locator(".el-dialog").filter({ hasText: "添加卡片" });
  await pickSelectOption(page, "数据集", datasetName);
  await cardDialog.getByLabel("卡片标题").fill("投屏用户总数");
  await cardDialog.getByRole("button", { name: "保存" }).click();
  await expect(cardDialog).not.toBeVisible();
  await page.getByRole("button", { name: "保存布局" }).click();

  // ---- 报表：创建 + 立即运行 ----
  await openMenuPath(page, ["数据分析"], "/analysis/report/index");
  await page.getByRole("button", { name: "新建报表" }).click();
  const reportDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "新建报表" });
  await reportDialog.getByLabel("名称").fill(reportName);
  await pickSelectOption(page, "数据集", datasetName);
  await reportDialog.getByLabel("收件人").fill("e2e@corp.com");
  // C5 收敛后弹窗按钮文案统一为框架口径「保存」（原手写弹窗为「确认」）
  await reportDialog.getByRole("button", { name: "保存" }).click();
  await expect(reportDialog).not.toBeVisible();

  const reportRow = page.getByRole("row", { name: reportName });
  await expect(reportRow).toBeVisible();
  await reportRow.getByRole("button", { name: "立即运行" }).click();
  await expect(page.getByText("已派发执行").first()).toBeVisible();
  await expect(reportRow.getByText(/SUCCESS/)).toBeVisible({ timeout: 20_000 });

  // ---- 大屏：创建 + 投屏 ----
  await openMenuPath(page, ["数据分析"], "/analysis/screen/index");
  await page.getByRole("button", { name: "新建大屏" }).click();
  const screenDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "新建大屏" });
  await screenDialog.getByLabel("名称").fill(screenName);
  // 仪表盘序列是 el-select multiple：选完不自动收起，残留下拉会拦截「保存」点击
  // （webkit 必现、chromium 时序侥幸），必须走多选辅助（选完点标题收起并等隐藏）
  await pickMultiSelectOptions(page, screenDialog, "仪表盘序列", [
    dashboardName
  ]);
  await screenDialog.getByRole("button", { name: "保存" }).click();
  await expect(screenDialog).not.toBeVisible();

  const screenRow = page.getByRole("row", { name: screenName });
  await screenRow.getByRole("button", { name: "投屏" }).click();
  const screenRoot = page.locator(".screen-root");
  await expect(
    screenRoot.locator("span", { hasText: `${screenName} · ${dashboardName}` })
  ).toBeVisible({ timeout: 15_000 });
  // 轮播页渲染卡片标题与数字
  await expect(screenRoot.getByText("投屏用户总数")).toBeVisible();
});

test("大屏远程控制：管理端下发切换，展示端实时跟随", async ({ page }) => {
  await login(page);

  const suffix = Math.random().toString(36).slice(2, 8);
  const dashA = `E2E遥控看板A-${suffix}`;
  const dashB = `E2E遥控看板B-${suffix}`;
  const screenName = `E2E遥控大屏-${suffix}`;

  // ---- 素材：两块看板（展示端切换的前后目标） ----
  await openMenuPath(page, ["数据分析"], "/analysis/dashboard/index");
  for (const name of [dashA, dashB]) {
    await page.getByRole("button", { name: "新建仪表盘" }).first().click();
    const dialog = page.locator(".el-dialog").filter({ hasText: "新建仪表盘" });
    await dialog.getByLabel("仪表盘名称").fill(name);
    await dialog.getByRole("button", { name: "保存" }).click();
    await expect(dialog).not.toBeVisible();
  }

  // ---- 大屏：仪表盘序列按 A → B 勾选（顺序即服务端下标序） ----
  await openMenuPath(page, ["数据分析"], "/analysis/screen/index");
  await page.getByRole("button", { name: "新建大屏" }).click();
  const screenDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "新建大屏" });
  await screenDialog.getByLabel("名称").fill(screenName);
  await pickMultiSelectOptions(page, screenDialog, "仪表盘序列", [
    dashA,
    dashB
  ]);
  await screenDialog.getByRole("button", { name: "保存" }).click();
  await expect(screenDialog).not.toBeVisible();

  // ---- 展示端：第二标签页打开投屏页（同 context 共享登录态与 WS 通道） ----
  const token = await getAccessToken(page);
  const listResp = await page.request.get(
    `${FRONT_URL}/api/system/screens?name=${encodeURIComponent(screenName)}&size=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const rows: Array<{ name?: string; pk?: string }> =
    (await listResp.json())?.data?.results ?? [];
  const screenPk = rows.find(item => item.name === screenName)?.pk;
  if (!screenPk) throw new Error(`未找到大屏 ${screenName}`);
  const display = await page.context().newPage();
  await display.goto(`/#/analysis/screen/display?pk=${screenPk}`);
  const root = display.locator(".screen-root");
  await expect(
    root.locator("span", { hasText: `${screenName} · ${dashA}` })
  ).toBeVisible({ timeout: 15_000 });
  // 默认自动轮播：无远程接管标记
  await expect(root.getByText("远程控制中")).toHaveCount(0);

  // ---- 管理端：远程控制面板切换到看板 B ----
  const screenRow = page.getByRole("row", { name: screenName });
  await screenRow.getByRole("button", { name: "远程控制" }).click();
  const controlDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "远程控制" });
  // 面板打开即读取服务端控制态（默认自动轮播）
  await expect(controlDialog.getByText("自动轮播")).toBeVisible({
    timeout: 10_000
  });
  await controlDialog.locator(".el-select").first().click();
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
      hasText: dashB
    })
    .first()
    .click();
  await controlDialog.getByRole("button", { name: "切换" }).click();
  await expect(page.getByText("指令已下发").first()).toBeVisible();

  // 展示端实时跟随：切到看板 B 并出现「远程控制中」（manual 停轮播）
  await expect(
    root.locator("span", { hasText: `${screenName} · ${dashB}` })
  ).toBeVisible({ timeout: 15_000 });
  await expect(root.getByText("远程控制中")).toBeVisible();

  // ---- 恢复轮播：展示端标记消失（回到 auto） ----
  await controlDialog.getByRole("button", { name: "恢复轮播" }).click();
  await expect(page.getByText("指令已下发").first()).toBeVisible();
  await expect(root.getByText("远程控制中")).toHaveCount(0);

  await display.close();
});
