import { expect, test } from "@playwright/test";

import {
  APPROVER,
  FRONT_URL,
  login,
  openMenuPath,
  waitAppWebSocket
} from "./helpers";

/**
 * WebSocket 实时消息推送 E2E（ADR-034 后改写）：聊天室公共房间 @提及 → 站内信推送。
 *
 * 链路：发送方在 `/ws/chat/`（聊天室通道）发消息 → 服务端落库 → 公共广播 +
 * `notify_mentions` 解析 @用户名 → `async_push_message` 投到接收者 `websocket_group_{pk}`
 * → 接收者浏览器的全局通道（`/ws/message/*`）收到 `push_message` 帧
 * （`data.message_type=chat_message`）。
 *
 * 为什么需要第二个浏览器上下文：@提及不提醒发送者自己，必须由另一个用户发出；
 * 两个参与者都用超管（E2E 种子里普通用户没有聊天室菜单授权）。
 *
 * 场景说明：导入完成站内信（ImportDataMessage）在 celery 任务链路发布，
 * 进程内 E2E（eager/无 worker）下该链路不可用（publish 的 async_to_sync
 * 会与 thread-sensitive 单线程互等，实测拖死整个 daphne）；聊天 @ 提及走
 * 纯异步 WS 上下文，同样覆盖「站内信 → channel layer → 浏览器帧」管道。
 */

test("聊天室 @消息 实时收到 push_message 站内信推送", async ({ page }) => {
  test.setTimeout(150_000);
  const wsOpened = waitAppWebSocket(page);
  await login(page);
  const ws = await wsOpened;
  const pushFrame = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("timeout waiting frame: push_message")),
      45_000
    );
    ws.on("framereceived", frame => {
      const payload =
        typeof frame.payload === "string"
          ? frame.payload
          : Buffer.from(frame.payload as Uint8Array).toString("utf-8");
      // 信封 action=push_message（message/base.py _send_base 按 event.type 回包），
      // 聊天 @ 消息的 data.message_type=chat_message
      if (payload.includes("push_message")) {
        clearTimeout(timer);
        resolve(payload);
      }
    });
  });

  // 接收方（xadmin）停在聊天室公共房间：既是推送目标，也顺带断言新通道广播可达
  await openMenuPath(page, [], "/default/chat/index");
  await expect(page.locator('[data-testid="chat-page"]')).toBeVisible({
    timeout: 20_000
  });

  const browser = page.context().browser();
  const contextB = await browser!.newContext({
    baseURL: FRONT_URL,
    locale: "zh-CN"
  });
  const pageB = await contextB.newPage();
  try {
    await login(pageB, APPROVER);
    await openMenuPath(pageB, [], "/default/chat/index");
    const inputB = pageB.locator('[data-testid="chat-input"] textarea');
    await inputB.waitFor({ state: "visible", timeout: 25_000 });
    const text = `@xadmin E2E 实时推送验证 ${Date.now()}`;
    await inputB.fill(text);
    await pageB.getByRole("button", { name: "发送" }).first().click();

    const frame = await pushFrame;
    expect(frame).toContain("push_message");
    expect(frame).toContain("chat_message");

    // 公共房间广播：接收方聊天页实时看到该消息（无需刷新）
    await expect(
      page
        .locator('[data-testid="chat-messages"]')
        .getByText(/E2E 实时推送验证/)
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await contextB.close();
  }
});
