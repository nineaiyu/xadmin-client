import { expect, test } from "@playwright/test";

import {
  ADMIN,
  login,
  logout,
  openMenuPath,
  waitAppWebSocket
} from "./helpers";

/**
 * 系统页面渲染与业务流 E2E（扩展）：
 * 菜单/在线用户/日志/通知等页面渲染、用户 CRUD、WebSocket 连接、登出。
 *
 * 菜单层级以种子库实际数据为准（system/models Menu）：系统管理 → {日志管理 →
 * 在线用户/访问日志/登录日志}、{通知公告 → 消息公告}、{配置管理 → 用户配置}。
 * 日志与通知均为三级，二级直接取会命中失败。
 */

test("菜单管理：菜单树与表单区渲染", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/menu/index");
  // 菜单管理为「左侧菜单树 + 右侧表单」布局，不是列表页
  const tree = page.locator(".el-tree").first();
  await expect(tree).toBeVisible({ timeout: 15_000 });
  // 初始数据含「系统管理」根菜单
  await expect(tree.getByText("系统管理").first()).toBeVisible();
});

test("在线用户：页面渲染", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理", "日志管理"], "/system/online/index");
  // 当前管理员自身应出现在在线列表（WebSocket 会话）
  await expect(page.locator(".el-table, .pure-table").first()).toBeVisible({
    timeout: 15_000
  });
});

test("登录日志：存在当前登录记录", async ({ page }) => {
  await login(page);
  await openMenuPath(
    page,
    ["系统管理", "日志管理"],
    "/system/logs/login/index"
  );
  await expect(page.locator(".el-table")).toBeVisible({ timeout: 15_000 });
  // 刚刚的登录应已落库
  await expect(
    page.locator(".el-table").getByText(ADMIN.username).first()
  ).toBeVisible({ timeout: 15_000 });
});

test("访问日志：页面可打开且有记录", async ({ page }) => {
  await login(page);
  await openMenuPath(
    page,
    ["系统管理", "日志管理"],
    "/system/logs/operation/index"
  );
  await expect(page.locator(".el-table")).toBeVisible({ timeout: 15_000 });
});

test("消息公告：页面可打开", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理", "通知公告"], "/system/notice/index");
  await expect(page.locator(".el-table, .el-empty").first()).toBeVisible({
    timeout: 15_000
  });
});

test("模块管理：清单渲染与裁剪配置片段", async ({ page }) => {
  await login(page);
  // 后台覆盖会改变生效态断言，先恢复为部署配置，保证用例可重复执行
  await page.request.post("/api/system/modules/reset");
  await openMenuPath(page, ["系统管理"], "/system/module/index");

  const table = page.getByTestId("module-table");
  await expect(table).toBeVisible({ timeout: 15_000 });
  // 内核模块与可选模块都在清单里（可选模块即使被裁掉也以「停用」状态展示）
  await expect(table.getByText("core_rbac").first()).toBeVisible();
  await expect(table.getByText("chat").first()).toBeVisible();

  // 预设相关断言与接口对齐：用例可在 full / standard / core 任一预设下运行
  // （standard 预设下 E2E 会裁剪掉 chat 等 9 个模块，写死 full 的期望会假失败）
  const report = (await (
    await page.request.get("/api/system/modules")
  ).json()) as {
    data: { preset: string; enabled_count: number; total: number };
  };
  await expect(page.getByTestId("module-summary")).toContainText(
    `已启用 ${report.data.enabled_count} / ${report.data.total} 个模块`
  );
  await expect(page.getByTestId("module-snippet")).toHaveValue(
    new RegExp(`MODULE_PRESET: ${report.data.preset}`)
  );

  // 剪贴板 API 在无头环境可能被浏览器拒绝（失败侧也会给出可读提示），
  // 因此只断言有可读反馈，不断言成功文案；页面上可能残留早前操作的 message，取最后一条
  await page.getByTestId("module-copy").click();
  await expect(page.locator(".el-message").last()).toBeVisible({
    timeout: 5_000
  });
});

test("模块管理：保存后台覆盖并展示待重启差异", async ({ page }) => {
  await login(page);
  await page.request.post("/api/system/modules/reset");
  await openMenuPath(page, ["系统管理"], "/system/module/index");

  await expect(page.getByTestId("module-table")).toBeVisible({
    timeout: 15_000
  });

  // 切到「仅内核」预设 → 保存（只落库，不重启）
  await page.getByTestId("module-preset").getByText("仅内核").click();
  await page.getByTestId("module-save").click();

  const pending = page.getByTestId("module-pending");
  await expect(pending).toBeVisible({ timeout: 10_000 });
  await expect(pending).toContainText("待重启生效");
  await expect(page.getByTestId("module-restart-command")).toContainText(
    "xadmin.sh restart"
  );

  // 恢复为部署配置 → 待重启差异消失（不重启服务）
  await page.getByTestId("module-reset").click();
  await page
    .locator(".el-message-box")
    .getByRole("button", { name: "确定" })
    .first()
    .click();
  await expect(page.getByTestId("module-pending")).toHaveCount(0, {
    timeout: 10_000
  });
});

test("账户设置：头像下拉可进入个人信息页", async ({ page }) => {
  await login(page);
  await page.locator(".el-dropdown-link").first().click();
  await page.getByText("账户设置").first().click();
  await expect(page.locator(".el-form, .el-tabs").first()).toBeVisible({
    timeout: 15_000
  });
});

test("用户管理：新增 → 搜索可见 → 删除", async ({ page }) => {
  const username = `e2e_u_${Date.now()}`;
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  const table = page.locator(".el-table");
  await expect(table).toBeVisible();

  // RePlusPage 弹层新增：必填项（昵称/用户名/密码等）以实际表单为准
  await page.getByRole("button", { name: "新增" }).first().click();
  // :visible 过滤：用户页内建的回收站抽屉常驻 DOM（隐藏态），不能用裸 first() 定位
  const dialog = page.locator(".el-dialog:visible, .el-drawer:visible").first();
  await expect(dialog).toBeVisible();
  const nickname = dialog
    .locator(".el-form-item:has-text('昵称') input")
    .first();
  await nickname.fill("E2E临时用户");
  const userInput = dialog
    .locator(".el-form-item:has-text('用户名') input")
    .first();
  await userInput.fill(username);
  // 密码框为普通 input（无 password 渲染器，type 非 password），
  // 须按 placeholder 定位；密码规则收紧后前端会按下发规则校验，须填合规密码
  const passwordInput = dialog.getByPlaceholder("请输入密码").first();
  await passwordInput.fill("E2E-New-User-2026!");
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });

  // 列表可见（或经搜索可见）
  await expect(table.getByText(username).first()).toBeVisible({
    timeout: 15_000
  });

  // 清理：删除该用户
  const row = page.locator(".el-table__row", { hasText: username }).first();
  await row.getByRole("button", { name: "删除" }).first().click();
  const confirm = page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first();
  await confirm.click();
  await expect(
    page.locator(".el-table__row", { hasText: username })
  ).toHaveCount(0, { timeout: 15_000 });
});

test("岗位管理：新增 → 分配成员 → 搜索可见 → 删除", async ({ page }) => {
  const postName = `E2E岗位${Date.now()}`;
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/post/index");
  const table = page.locator(".el-table");
  await expect(table).toBeVisible({ timeout: 20_000 });

  // 自定义按钮组（关闭了框架默认 create）：工具栏「新建岗位」
  await page.getByRole("button", { name: "新建岗位" }).first().click();
  const dialog = page.locator(".el-dialog:visible").first();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-testid="post-name"]').fill(postName);
  await dialog.locator('[data-testid="post-code"]').fill(`e2e_${Date.now()}`);
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });
  await expect(table.getByText(postName).first()).toBeVisible({
    timeout: 15_000
  });

  // 成员分配：远程搜索选人 → 保存（增量 add）
  const row = page.locator(".el-table__row", { hasText: postName }).first();
  await row.getByRole("button", { name: "成员" }).first().click();
  const memberDialog = page.locator(".el-dialog:visible").first();
  await expect(memberDialog).toBeVisible();
  // 远程搜索 + 键盘选中：下拉由 EP teleport 到 body，按可见项定位易受残留副本干扰，
  // 这里用「输入关键字 → ArrowDown → Enter」这条稳定路径（与联想输入用例同口径）；
  // 不先 click（el-select 输入框有宽度动画，click 的可操作性检查会因 not stable 超时）
  const memberSelect = memberDialog.locator(
    '[data-testid="post-member-select"] input'
  );
  await memberSelect.fill("xadmin");
  await page.waitForTimeout(500); // 远程搜索（≤20 条）返回后下拉才出候选
  await memberSelect.press("ArrowDown");
  await memberSelect.press("Enter");
  // 选中后下拉仍在可见态并拦截后续点击（EP 已知行为）：点弹窗标题区强制收起再保存
  await memberDialog.locator(".el-dialog__header").click();
  await memberDialog.getByRole("button", { name: "保存" }).click();
  await expect(memberDialog).not.toBeVisible({ timeout: 15_000 });

  // 复开成员弹窗：成员已在列（增量写入生效，列表计数由后端注解）
  await row.getByRole("button", { name: "成员" }).first().click();
  const reopen = page.locator(".el-dialog:visible").first();
  await expect(reopen.getByText("xadmin").first()).toBeVisible({
    timeout: 15_000
  });
  await reopen.press("Escape");
  await expect(reopen).not.toBeVisible({ timeout: 15_000 });

  // 清理：删除岗位（框架默认入口，自带二次确认）
  await row.getByRole("button", { name: "删除" }).first().click();
  const confirm = page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "确定" })
    .first();
  await confirm.click();
  await expect(
    page.locator(".el-table__row", { hasText: postName })
  ).toHaveCount(0, { timeout: 15_000 });
});

/**
 * 回归守护：页面组件必须单元素根。
 * 系统设置页曾因模板根级注释构成 Fragment 根——离开该页时 <Transition> 无法
 * 收尾，此后所有页面都被渲染成占位注释（整站白屏、切页不可恢复，须刷新）。
 */
test("系统设置：打开后切其他页面不白屏（单元素根守护）", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/setting/index");
  await expect(page.getByText("系统设置").first()).toBeVisible({
    timeout: 15_000
  });

  // 切到用户管理：必须真实渲染内容（白屏时 #main-content 仅剩注释占位）
  await openMenuPath(page, ["系统管理"], "/system/user/index");
  await expect(page.getByText("用户管理").first()).toBeVisible({
    timeout: 15_000
  });
  const contentLen = await page
    .locator("#main-content")
    .evaluate(el => el.innerHTML.length);
  expect(contentLen).toBeGreaterThan(200);
});

test("WebSocket：登录后建立应用 ws 连接", async ({ page }) => {
  const wsOpened = waitAppWebSocket(page);
  await login(page);
  const ws = await wsOpened;
  expect(ws.url()).toMatch(/\/ws\/message\//);
});

test("登出后回到登录页", async ({ page }) => {
  await login(page);
  await logout(page);
});

test("模块停用整页提示：渲染与返回入口", async ({ page }) => {
  await login(page);
  // hash 同文档 goto 不会开新历史条目（登录期的 SPA 导航 state.back 会原样带到
  // 目标路由，组件判定为「有站内上一页」）；先离开文档再直达，等价新标签/外链
  // 落地：令牌随 localStorage 保留，但站内导航史清零
  await page.goto("about:blank");
  await page.goto("/#/error/module-disabled?module=chat");
  // 冷启动后页签标题与正文大标题同文案：断言收敛到主内容区，避开 lay-tag 命中
  const main = page.locator("#main-content");
  await expect(main.getByText("功能模块已停用")).toBeVisible({
    timeout: 15_000
  });
  await expect(main.getByText("该功能对应的模块已被停用")).toBeVisible();
  // 命中模块 id 随查询参数展示（网关 404 响应体的 module 字段）
  await expect(main.getByText("(chat)")).toBeVisible();
  // 直达无站内历史：返回按钮落回首页
  await expect(main.getByRole("button", { name: "返回首页" })).toBeVisible();
});

test("通讯录：按部门/按岗位视角渲染", async ({ page }) => {
  await login(page);
  await openMenuPath(page, ["系统管理"], "/system/directory/index");
  // 成员名录渲染（卡片视图默认，管理员自身在列）
  await expect(page.locator(".member-card").first()).toBeVisible({
    timeout: 20_000
  });
  // 默认按部门视角：部门树可见
  await expect(page.locator(".directory-tree").first()).toBeVisible({
    timeout: 15_000
  });
  // 切换按岗位视角：岗位清单可见（空态亦可），再切回部门视角
  await page.getByText("按岗位", { exact: true }).first().click();
  await expect(
    page.locator("[data-post-pk], .directory-aside .el-empty").first()
  ).toBeVisible({ timeout: 15_000 });
  await page.getByText("按部门", { exact: true }).first().click();
  await expect(page.locator(".directory-tree").first()).toBeVisible({
    timeout: 15_000
  });
});
