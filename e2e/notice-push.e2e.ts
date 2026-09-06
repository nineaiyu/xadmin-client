import { expect, test } from "@playwright/test";

import { BACKEND_URL, login } from "./helpers";

/**
 * WebSocket 实时消息推送 E2E（T4.3）：登录建立 WS 连接后，同步导入完成触发
 * ImportDataMessage 站内信，后端经 channel layer 推送 push_message 帧，
 * 断言浏览器侧真实收到 {message_type: "notify_message"} 载荷。
 */

const BACKEND = BACKEND_URL;

function firstFrameContaining(
  ws: import("@playwright/test").WebSocket,
  needle: string
) {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout waiting frame: ${needle}`)),
      30_000
    );
    ws.on("framereceived", frame => {
      const payload =
        typeof frame.payload === "string"
          ? frame.payload
          : Buffer.from(frame.payload as Uint8Array).toString("utf-8");
      if (payload.includes(needle)) {
        clearTimeout(timer);
        resolve(payload);
      }
    });
  });
}

test("导入完成后实时收到 push_message 站内信推送", async ({ page }) => {
  test.setTimeout(90_000);
  const wsOpened = page.waitForEvent("websocket", { timeout: 20_000 });
  await login(page);
  const ws = await wsOpened;
  const pushFrame = firstFrameContaining(ws, "notify_message");

  // 通过浏览器会话（携带认证 Cookie）触发一次同步导入，完成后后端向操作者推送站内信
  const username = `e2e_ws_${Date.now()}`;
  const response = await page.request.post(
    `${BACKEND}/api/system/user/import-data?action=create&task=false`,
    {
      headers: { "User-Agent": "e2e-test" },
      multipart: {
        file: {
          name: "e2e-ws.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(
            `username,nickname\n${username},E2E推送\n`,
            "utf-8"
          )
        }
      }
    }
  );
  expect(response.status()).toBe(200);

  const frame = await pushFrame;
  expect(frame).toContain("notify_message");
  expect(frame).toContain("push_message");
});
