import { expect, test } from "@playwright/test";

import {
  APPROVER,
  FRONT_URL,
  login,
  openMenuPath,
  waitAppWebSocket
} from "./helpers";

/**
 * 聊天室 E2E（ADR-034）：微信式两栏布局 + 公共聊天室收发持久化 + 私聊实时送达与未读红点。
 *
 * 页面选择器以 `data-testid` 为主（chat-page / chat-room-* / chat-contact-* /
 * chat-messages / chat-input / chat-send），仅「刷新」「发送」按文案定位。
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
