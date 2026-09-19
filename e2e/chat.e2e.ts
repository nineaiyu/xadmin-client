import { expect, test } from "@playwright/test";

import {
  APPROVER,
  FRONT_URL,
  login,
  openMenuPath,
  waitAppWebSocket
} from "./helpers";

/**
 * 聊天室 E2E：微信式两栏布局 + 公共聊天室收发持久化 + 私聊实时送达与未读红点
 * + 多人群聊（建群/改名/增减成员/退群）。
 *
 * 页面选择器以 `data-testid` 为主（chat-page / chat-room-* / chat-contact-* /
 * chat-messages / chat-input / chat-send / chat-group-*），仅个别按钮按文案定位。
 * 两个参与者都用超管（xadmin / e2e_approver）：聊天室接口按菜单权限点门控，
 * E2E 种子里的普通用户没有聊天室菜单授权（授权形态由后端守护测试覆盖）。
 */

test("聊天室：两栏布局与公共聊天室收发持久化", async ({ page }) => {
  test.setTimeout(120_000);
  const wsOpened = waitAppWebSocket(page);
  await login(page);
  await wsOpened;
  await openMenuPath(page, [], "/default/chat/index");

  const chatPage = page.locator('[data-testid="chat-page"]');
  await expect(chatPage).toBeVisible({ timeout: 20_000 });
  // 左栏：会话（公共聊天室）与最近在线两段；右栏：消息区与输入区
  await expect(page.locator('[data-testid="chat-room-public"]')).toBeVisible();
  await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible();

  const input = page.locator('[data-testid="chat-input"] textarea');
  await input.waitFor({ state: "visible", timeout: 20_000 });
  const text = `E2E-公共聊天室-${Date.now()}`;
  await input.fill(text);
  await page.getByRole("button", { name: "发送" }).first().click();

  await expect(
    page.locator('[data-testid="chat-messages"]').getByText(text)
  ).toBeVisible({ timeout: 15_000 });

  // 刷新后历史仍在（服务端落库 + 游标分页恢复）
  await page.reload();
  await expect(page.locator('[data-testid="chat-page"]')).toBeVisible({
    timeout: 25_000
  });
  await expect(
    page.locator('[data-testid="chat-messages"]').getByText(text)
  ).toBeVisible({ timeout: 25_000 });
});

test("聊天室：表情包光标处插入", async ({ page }) => {
  test.setTimeout(90_000);
  const wsOpened = waitAppWebSocket(page);
  await login(page);
  await wsOpened;
  await openMenuPath(page, [], "/default/chat/index");
  await expect(page.locator('[data-testid="chat-page"]')).toBeVisible({
    timeout: 20_000
  });

  const input = page.locator('[data-testid="chat-input"] textarea');
  await input.waitFor({ state: "visible", timeout: 20_000 });
  await page.locator('[data-testid="chat-emoji"]').first().click();
  const panel = page.locator('[data-testid="chat-emoji-panel"]');
  await panel.waitFor({ state: "visible", timeout: 10_000 });

  // 空草稿点第一个表情 → 直接成为内容
  await panel.locator("button").first().click();
  const firstEmoji = await panel.locator("button").first().innerText();
  await expect(input).toHaveValue(firstEmoji.trim());

  // 光标停在插入内容之后：再点第二个表情 → 顺序拼接（微信式连发表情）
  await panel.locator("button").nth(1).click();
  const secondEmoji = (await panel.locator("button").nth(1).innerText()).trim();
  await expect(input).toHaveValue(firstEmoji.trim() + secondEmoji);
});

test("聊天室：私聊实时送达、未读红点与已读清零", async ({ page }) => {
  test.setTimeout(150_000);
  const wsOpened = waitAppWebSocket(page);
  await login(page);
  await wsOpened;
  await openMenuPath(page, [], "/default/chat/index");
  await expect(page.locator('[data-testid="chat-page"]')).toBeVisible({
    timeout: 20_000
  });

  // 第二个参与者（第二超管）：打开聊天室后停在公共聊天室，便于观察私聊未读红点
  const browser = page.context().browser();
  const contextB = await browser!.newContext({
    baseURL: FRONT_URL,
    locale: "zh-CN"
  });
  const pageB = await contextB.newPage();
  try {
    await login(pageB, APPROVER);
    await openMenuPath(pageB, [], "/default/chat/index");
    await expect(pageB.locator('[data-testid="chat-page"]')).toBeVisible({
      timeout: 25_000
    });
    await pageB.locator('[data-testid="chat-room-public"]').click();

    // A 侧刷新联系人（对端刚登录，会话才可见）→ 点联系人开通私聊
    await page.getByRole("button", { name: "刷新" }).first().click();
    const contact = page.locator('[data-testid="chat-contact-e2e_approver"]');
    await contact.waitFor({ state: "visible", timeout: 20_000 });
    await contact.click();
    await expect(page.locator('[data-testid="chat-room-private"]')).toBeVisible(
      {
        timeout: 15_000
      }
    );
    // 会话行在上次运行后可能已存在（复用库 / 双浏览器第二段），此时上面这行不等价于
    // 「已切进私聊」：必须在填草稿前确认房间标题已切换，否则 openPrivate 的 activate
    // 生效时会触发「切换会话清空草稿」，把刚填进去的文本清掉（发送按钮随即置灰）
    await expect(page.locator('[data-testid="chat-room-title"]')).toHaveText(
      "E2E审批人",
      { timeout: 15_000 }
    );

    const text = `E2E-私聊-${Date.now()}`;
    const input = page.locator('[data-testid="chat-input"] textarea');
    await input.fill(text);
    await page.getByRole("button", { name: "发送" }).first().click();

    // B 侧：私聊会话出现且带未读红点
    const badgeB = pageB.locator(
      '[data-testid="chat-room-private"] .el-badge__content'
    );
    await badgeB.waitFor({ state: "visible", timeout: 25_000 });

    // B 点进私聊：消息实时可见（历史 + 实时通道）且红点清零
    await pageB.locator('[data-testid="chat-room-private"]').click();
    await expect(
      pageB.locator('[data-testid="chat-messages"]').getByText(text)
    ).toBeVisible({ timeout: 15_000 });
    await expect(badgeB).toHaveCount(0, { timeout: 15_000 });

    // A 侧：自己的消息在消息区（广播回执对齐乐观上屏，不重复）
    await expect(
      page.locator('[data-testid="chat-messages"]').getByText(text)
    ).toHaveCount(1);
  } finally {
    await contextB.close();
  }
});

test("聊天室：多人群聊建群、消息、成员管理与退群", async ({ page }) => {
  test.setTimeout(180_000);
  const wsOpened = waitAppWebSocket(page);
  await login(page);
  await wsOpened;
  await openMenuPath(page, [], "/default/chat/index");
  await expect(page.locator('[data-testid="chat-page"]')).toBeVisible({
    timeout: 20_000
  });

  const suffix = Date.now();
  const groupName = `E2E群聊-${suffix}`;
  const renamedGroup = `${groupName}-改`;

  // ---- 建群：群名 + 远程搜索一名成员（e2e_approver，创建者自动成为群主） ----
  await page.locator('[data-testid="chat-new-group"]').click();
  const createDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "新建群聊" });
  // el-input 把 $attrs 透传到内部 <input>（inheritAttrs:false + mergeProps），
  // 按 placeholder 定位内外形态都稳（data-testid 落在 input 本身，不能再加 " input" 后缀）
  await createDialog.getByPlaceholder("请输入群名称").fill(groupName);
  const memberSelect = createDialog.locator(".el-select").first();
  await memberSelect.click();
  await memberSelect.locator("input").first().fill("e2e_approver");
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
      hasText: "e2e_approver"
    })
    .first()
    .click();
  // 多选下拉不自动收起：点标题收起后提交（ReDialog 默认「保存」按钮）
  await createDialog.locator(".el-dialog__header").click();
  await createDialog.getByRole("button", { name: "保存" }).click();
  await expect(createDialog).not.toBeVisible();

  // 会话列表出现群聊（2 人）并自动选中
  const groupRoom = page.locator('[data-testid="chat-room-group"]', {
    hasText: groupName
  });
  await expect(groupRoom).toBeVisible({ timeout: 15_000 });
  await expect(groupRoom).toContainText("2 人");

  // ---- 群消息：发送后上屏 ----
  const text = `E2E-群消息-${suffix}`;
  const input = page.locator('[data-testid="chat-input"] textarea');
  await input.fill(text);
  await page.locator('[data-testid="chat-send"]').click();
  await expect(
    page.locator('[data-testid="chat-messages"]').getByText(text)
  ).toBeVisible({ timeout: 15_000 });

  // ---- 成员面板：群主标识 + 成员列表（群主 xadmin 与 e2e_approver） ----
  await page.locator('[data-testid="chat-group-members"]').click();
  const membersDialog = page
    .locator(".el-dialog")
    .filter({ hasText: "群成员" });
  const memberRows = membersDialog.locator(
    '[data-testid^="chat-group-member-"]'
  );
  await expect(memberRows).toHaveCount(2, { timeout: 15_000 });
  await expect(membersDialog.getByText("群主")).toBeVisible();
  await expect(membersDialog.getByText("E2E审批人")).toBeVisible();

  // 改名（仅群主可见入口）→ 会话列表行同步新群名
  await membersDialog.getByPlaceholder("请输入群名称").fill(renamedGroup);
  await membersDialog.locator('[data-testid="chat-group-rename"]').click();
  await expect(
    page.locator('[data-testid="chat-room-group"]', { hasText: renamedGroup })
  ).toBeVisible({ timeout: 15_000 });

  // 拉人入群（e2e_user / 昵称 E2E普通用户）→ 成员 3 人、会话行计数同步
  const addSelect = membersDialog.locator(".el-select").first();
  await addSelect.click();
  await addSelect.locator("input").first().fill("e2e_user");
  await page
    .locator(".el-select-dropdown:visible .el-select-dropdown__item", {
      hasText: "e2e_user"
    })
    .first()
    .click();
  await membersDialog.locator('[data-testid="chat-group-add-confirm"]').click();
  await expect(memberRows).toHaveCount(3, { timeout: 15_000 });
  await expect(
    page.locator('[data-testid="chat-room-group"]', { hasText: "3 人" })
  ).toBeVisible({ timeout: 15_000 });

  // 移除成员：删掉刚加入的 e2e_user，回到 2 人
  const addedRow = membersDialog.locator(
    '[data-testid^="chat-group-member-"]',
    {
      hasText: "E2E普通用户"
    }
  );
  await addedRow.getByRole("button", { name: "移除成员" }).click();
  await expect(memberRows).toHaveCount(2, { timeout: 15_000 });

  // ---- 退群（群主退出自动转让；二次确认）→ 会话从列表消失 ----
  await membersDialog.getByRole("button", { name: "退出群聊" }).click();
  const confirm = page
    .locator(".el-popconfirm, .el-popper, .el-message-box")
    .getByRole("button", { name: "退出群聊" })
    .first();
  await confirm.click();
  await expect(
    page.locator('[data-testid="chat-room-group"]', { hasText: renamedGroup })
  ).toHaveCount(0, { timeout: 15_000 });
});
