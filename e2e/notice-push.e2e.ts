import { expect, test } from "@playwright/test";

import { login, openMenuPath, waitAppWebSocket } from "./helpers";

/**
 * WebSocket 实时消息推送 E2E：登录建立 WS 连接后，聊天室发送
 * @提及 消息触发站内信（notify_at_user_msg → async_push_message），
 * 后端经 channel layer 以 {type: "push_message"} 推送到用户分组，
 * 断言浏览器侧真实收到该帧（data.message_type=chat_message）。
 *
 * 场景说明：导入完成站内信（ImportDataMessage）在 celery 任务链路发布，
 * 进程内 E2E（eager/无 worker）下该链路不可用（publish 的 async_to_sync
 * 会与 thread-sensitive 单线程互等，实测拖死整个 daphne）；聊天 @ 提及走
 * 纯异步 WS 上下文，同样覆盖「站内信 → channel layer → 浏览器帧」管道。
 */

test("聊天室 @消息 实时收到 push_message 站内信推送", async ({ page }) => {
  test.setTimeout(90_000);
  const wsOpened = waitAppWebSocket(page);
  await login(page);
  const ws = await wsOpened;
  const pushFrame = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("timeout waiting frame: push_message")),
      30_000
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

  // 聊天室（管理员默认菜单），发送 @提及 自己的消息触发站内信推送
  await openMenuPath(page, [], "/default/chat/index");
  const editor = page.getByPlaceholder("输入消息并回车发送");
  await editor.waitFor({ state: "visible", timeout: 15_000 });
  await editor.fill("@xadmin E2E 实时推送验证");
  await page.getByRole("button", { name: "发送" }).first().click();

  const frame = await pushFrame;
  expect(frame).toContain("push_message");
  expect(frame).toContain("chat_message");
});
