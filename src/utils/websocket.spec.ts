import { describe, expect, it, vi } from "vitest";

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
  onclose: ((ev?: { code?: number }) => void) | null = null;
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

  /** 测试辅助：带关闭码断开（4401/4403 等服务端拒连语义） */
  dropWithCode(code: number) {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code });
  }
}

vi.stubGlobal("WebSocket", FakeWebSocket);

import { WS, setReconnectTokenProvider, type WSOptions } from "./websocket";

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

  it("重连前调用注入的 token 刷新器", async () => {
    vi.useFakeTimers();
    const provider = vi.fn(async () => undefined);
    setReconnectTokenProvider(provider);
    try {
      const { instances } = makeWS();
      instances[0].drop();
      await vi.advanceTimersByTimeAsync(3000);
      expect(provider).toHaveBeenCalledTimes(1);
      expect(instances).toHaveLength(2);
    } finally {
      setReconnectTokenProvider(null);
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

  it("4401（未认证）/ 4403（无权限）是终态：不再无限退避重连", async () => {
    vi.useFakeTimers();
    try {
      for (const code of [4401, 4403]) {
        const { ws, instances } = makeWS();
        instances[0].dropWithCode(code);
        await vi.advanceTimersByTimeAsync(60000);
        expect(instances).toHaveLength(1);
        // 释放 visibilitychange 监听与计时器（避免干扰后续用例的可见性断言）
        ws.close();
      }
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

  it("send：OPEN 直接发送；延后发送到点先复查 readyState，不盲发", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { ws, instances } = makeWS();
      // CONNECTING：延后 3s，到点仍未就绪 → 不发，再等一轮；期间连接建立 → 6s 发出
      ws.send("first");
      expect(instances[0].sent).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(3000);
      expect(instances[0].sent).toHaveLength(0);
      instances[0].open();
      await vi.advanceTimersByTimeAsync(3000);
      expect(instances[0].sent).toEqual(["first"]);
      expect(warn).not.toHaveBeenCalled();

      // 顺延一轮后仍未就绪：放弃发送并告警（连接可能还在退避重连中）
      instances[0].readyState = FakeWebSocket.CLOSED;
      ws.send("second");
      expect(instances).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(6000);
      expect(instances[1].sent).toHaveLength(0);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      vi.useRealTimers();
    }
  });

  it("send：CLOSED 先重连，新连接就绪后延后发送落到新连接", async () => {
    vi.useFakeTimers();
    try {
      const { ws, instances } = makeWS();
      instances[0].open();
      instances[0].drop();
      ws.send("second");
      expect(instances).toHaveLength(2);
      expect(instances[1].sent).toHaveLength(0);
      // 新连接在复查到点前建立：报文落在新连接上
      instances[1].open();
      await vi.advanceTimersByTimeAsync(3000);
      expect(instances[1].sent).toEqual(["second"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("重连后 onmessage 重绑到新连接（回调不丢，重连不再永久静默）", async () => {
    vi.useFakeTimers();
    try {
      const { ws, instances } = makeWS();
      const received: unknown[] = [];
      ws.onMessage(data => received.push(data));
      instances[0].open();
      instances[0].onmessage?.({ data: JSON.stringify({ kind: "first" }) });
      expect(received).toEqual([{ kind: "first" }]);

      // 断线退避重连：新 socket 上的消息仍走同一回调
      instances[0].drop();
      await vi.advanceTimersByTimeAsync(3000);
      expect(instances).toHaveLength(2);
      instances[1].onmessage?.({
        data: JSON.stringify({ kind: "after-reconnect" })
      });
      expect(received).toEqual([
        { kind: "first" },
        { kind: "after-reconnect" }
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("心跳看门狗：连续 3 个周期无下行帧主动断开半开连接", async () => {
    vi.useFakeTimers();
    try {
      const { instances } = makeWS({
        heartbeat: { interval: 1000, message: "ping" }
      });
      const socket = instances[0];
      socket.open();
      // 正常节奏：每秒有下行帧（pong）→ 不触发看门狗
      await vi.advanceTimersByTimeAsync(3000);
      socket.onmessage?.({ data: JSON.stringify({ kind: "pong" }) });
      await vi.advanceTimersByTimeAsync(3000);
      expect(socket.readyState).toBe(FakeWebSocket.OPEN);

      // 静默：4 个周期无任何下行帧 → 看门狗主动 close
      //（真实 WebSocket 的 close 会异步触发 onclose → 退避重连链，链路另有用例覆盖）
      await vi.advanceTimersByTimeAsync(4000);
      expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
    } finally {
      vi.useRealTimers();
    }
  });

  it("心跳看门狗：下行帧持续喂活时不误杀连接", async () => {
    vi.useFakeTimers();
    try {
      const { instances } = makeWS({
        heartbeat: { interval: 1000, message: "ping" }
      });
      const socket = instances[0];
      socket.open();
      for (let tick = 0; tick < 8; tick++) {
        await vi.advanceTimersByTimeAsync(1000);
        socket.onmessage?.({ data: "pong" });
      }
      expect(socket.readyState).toBe(FakeWebSocket.OPEN);
    } finally {
      vi.useRealTimers();
    }
  });

  it("onMessage 晚于 connect 调用、随后重连：回调在两次连接上都生效", () => {
    const { ws, instances } = makeWS();
    const received: unknown[] = [];
    // 无 socket 时期调用（回调先存实例，connect 时再绑）不抛错
    expect(() => ws.onMessage(data => received.push(data))).not.toThrow();
    instances[0].open();
    instances[0].onmessage?.({ data: JSON.stringify({ n: 1 }) });
    expect(received).toEqual([{ n: 1 }]);
  });

  it("send：OPEN 态浏览器层抛错被兜住不冒泡", () => {
    const { ws, instances } = makeWS();
    instances[0].open();
    vi.spyOn(instances[0], "send").mockImplementation(() => {
      throw new Error("InvalidStateError");
    });
    expect(() => ws.send("boom")).not.toThrow();
  });
});
