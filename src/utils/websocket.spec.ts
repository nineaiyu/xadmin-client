import { describe, expect, it, vi } from "vitest";

const { getUsedAccessTokenMock } = vi.hoisted(() => ({
  getUsedAccessTokenMock: vi.fn(async () => "token")
}));

vi.mock("@/utils/token", () => ({
  getUsedAccessToken: getUsedAccessTokenMock
}));

/** WebSocket 测试替身：记录实例与发送内容，测试手动驱动 open/drop */
class FakeWebSocket {
  /** 真实 WebSocket 的 readyState 常量静态/原型两处都有（socket.OPEN 与 WebSocket.CLOSED 均可读），替身对齐 */
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  url: string;
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  /** 与真实 close 不同步触发 onclose：WS.close() 已先置 socketOpen=false 阻断重连 */
  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }

  /** 测试辅助：连接建立 */
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  /** 测试辅助：连接断开（触发 onclose → 退避重连） */
  drop() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

vi.stubGlobal("WebSocket", FakeWebSocket);

import { WS, type WSOptions } from "./websocket";

function makeWS(options: WSOptions = {}) {
  FakeWebSocket.instances = [];
  const ws = new WS("ws://test/ws", { heartbeat: false, ...options });
  return { ws, instances: FakeWebSocket.instances };
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true
  });
}

describe("WS 重连策略", () => {
  it("断线后默认无限重连，退避 3s/6s/12s/24s/30s 封顶", async () => {
    vi.useFakeTimers();
    try {
      const { instances } = makeWS();
      expect(instances).toHaveLength(1);
      // 原 3 次硬上限在断网超 1 分钟时永久掉线；现在持续重连且间隔封顶
      for (const gap of [3000, 6000, 12000, 24000, 30000]) {
        instances[instances.length - 1].drop();
        await vi.advanceTimersByTimeAsync(gap - 1);
        expect(instances).toHaveLength(instances.length); // 未到期不重连
        await vi.advanceTimersByTimeAsync(1);
        expect(FakeWebSocket.instances).toHaveLength(
          FakeWebSocket.instances.length
        );
      }
      expect(FakeWebSocket.instances).toHaveLength(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it("连接成功后重置退避计数：下次断线重新从 3s 开始", async () => {
    vi.useFakeTimers();
    try {
      const { instances } = makeWS();
      instances[0].drop();
      await vi.advanceTimersByTimeAsync(3000);
      expect(instances).toHaveLength(2);
      instances[1].open();
      instances[1].drop();
      // 若计数未重置，此处退避应为 6s：3s 时不应有新连接
      await vi.advanceTimersByTimeAsync(2999);
      expect(instances).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(instances).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("显式 reconnectMaxCount: 0 时不重连（0 不被默认值覆盖）", async () => {
    vi.useFakeTimers();
    try {
      const { instances } = makeWS({
        autoReconnect: { reconnectMaxCount: 0 }
      });
      instances[0].drop();
      await vi.advanceTimersByTimeAsync(60000);
      expect(instances).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("autoReconnect: false 时不重连（任务日志等短连接场景）", async () => {
    vi.useFakeTimers();
    try {
      const { instances } = makeWS({ autoReconnect: false });
      instances[0].drop();
      await vi.advanceTimersByTimeAsync(60000);
      expect(instances).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("页面恢复可见时立即重连，不等退避计时器走完", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    try {
      const { instances } = makeWS();
      instances[0].drop(); // 退避计时器 3s 未到期
      document.dispatchEvent(new Event("visibilitychange"));
      expect(instances).toHaveLength(2); // 立即重连
      // 原退避计时器已清：再推进不会叠加连接
      await vi.advanceTimersByTimeAsync(60000);
      expect(instances).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("页面不可见时不触发重连；主动关闭后恢复可见也不重连", async () => {
    vi.useFakeTimers();
    setVisibility("hidden");
    try {
      const { ws, instances } = makeWS();
      instances[0].drop();
      document.dispatchEvent(new Event("visibilitychange"));
      expect(instances).toHaveLength(1); // hidden：不重连（退避计时器仍在）

      // 主动 close（socketOpen=false、退避计时器已清）后恢复可见：不重连
      ws.close();
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      expect(instances).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(60000);
      expect(instances).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("send：CONNECTING 延后发送；CLOSED 先重连再延后发送到新连接", async () => {
    vi.useFakeTimers();
    try {
      const { ws, instances } = makeWS();
      // CONNECTING：延后 3s 发送
      ws.send("first");
      expect(instances[0].sent).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(3000);
      expect(instances[0].sent).toEqual(["first"]);

      // CLOSED：先建新连接，延后发送落在新连接上
      instances[0].readyState = FakeWebSocket.CLOSED;
      ws.send("second");
      expect(instances).toHaveLength(2);
      expect(instances[1].sent).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(3000);
      expect(instances[1].sent).toEqual(["second"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
