import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCrossTabSync } from "../crossTabSync";

const STORAGE_KEY = "xadmin-cross-tab-event";

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  listeners = new Set<(event: MessageEvent) => void>();
  posted: unknown[] = [];
  closed = false;

  constructor(public name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  addEventListener(type: string, handler: (event: MessageEvent) => void) {
    if (type === "message") this.listeners.add(handler);
  }

  removeEventListener(type: string, handler: (event: MessageEvent) => void) {
    if (type === "message") this.listeners.delete(handler);
  }

  postMessage(data: unknown) {
    this.posted.push(data);
  }

  close() {
    this.closed = true;
  }

  /** 模拟来自其他标签的消息 */
  emit(data: unknown) {
    this.listeners.forEach(handler => handler({ data } as MessageEvent));
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("跨标签同步通道（BroadcastChannel 优先）", () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
  });

  it("publish 通过 BroadcastChannel 发出带 nonce 的事件", () => {
    const sync = createCrossTabSync();
    sync.publish({ type: "user:logout" });
    const channel = FakeBroadcastChannel.instances.at(-1)!;
    expect(channel.name).toBe("xadmin-cross-tab");
    const payload = channel.posted.at(-1) as Record<string, unknown>;
    expect(payload.type).toBe("user:logout");
    expect(typeof payload.nonce).toBe("string");
  });

  it("订阅收到消息；同一 nonce 重复到达只回调一次", () => {
    const sync = createCrossTabSync();
    const handler = vi.fn();
    sync.subscribe(handler);
    const channel = FakeBroadcastChannel.instances.at(-1)!;
    const message = {
      type: "site:preferences",
      keys: ["DarkMode"],
      nonce: "n-1"
    };
    channel.emit(message);
    channel.emit({ ...message });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: "site:preferences",
      keys: ["DarkMode"]
    });
  });

  it("取消订阅后不再回调；close 关闭通道", () => {
    const sync = createCrossTabSync();
    const handler = vi.fn();
    const unsubscribe = sync.subscribe(handler);
    const channel = FakeBroadcastChannel.instances.at(-1)!;
    unsubscribe();
    channel.emit({ type: "user:logout", nonce: "n-2" });
    expect(handler).not.toHaveBeenCalled();
    sync.close();
    expect(channel.closed).toBe(true);
  });
});

describe("跨标签同步通道（storage 事件兜底）", () => {
  beforeEach(() => {
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", undefined);
  });

  it("无 BroadcastChannel 时写入 localStorage，并可经 storage 事件收到", () => {
    const sync = createCrossTabSync();
    const handler = vi.fn();
    sync.subscribe(handler);

    sync.publish({ type: "user:logout" });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const payload = JSON.parse(raw!) as Record<string, unknown>;
    expect(payload.type).toBe("user:logout");

    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY, newValue: raw })
    );
    expect(handler).toHaveBeenCalledWith({ type: "user:logout" });
  });

  it("其它 key 或非法载荷被忽略", () => {
    const sync = createCrossTabSync();
    const handler = vi.fn();
    sync.subscribe(handler);
    window.dispatchEvent(
      new StorageEvent("storage", { key: "other", newValue: "{}" })
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY, newValue: "not-json" })
    );
    expect(handler).not.toHaveBeenCalled();
  });
});
