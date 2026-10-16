import { beforeEach, describe, expect, it, vi } from "vitest";

const { elMessage, closeAll, handlers } = vi.hoisted(() => {
  const list: { close: ReturnType<typeof vi.fn> }[] = [];
  interface CapturedMessage {
    customClass?: string;
    onClose?: () => void;
  }
  // 返回类型放宽为 unknown：用例既验证「透传 ElMessage 返回值」，又覆盖
  // mockReturnValue 的场景，不锁定具体句柄形态
  const mock = vi.fn((_options?: CapturedMessage): unknown => {
    const handler = { close: vi.fn() };
    list.push(handler);
    return handler;
  });
  return { elMessage: mock, closeAll: vi.fn(), handlers: list };
});

vi.mock("element-plus/es/components/message/index.mjs", () => ({
  ElMessage: Object.assign(elMessage, { closeAll })
}));

import {
  closeAllMessage,
  closeKeyedMessage,
  keyedMessage,
  message,
  withKeyedLoading
} from "../message";

beforeEach(() => {
  // 每个用例都回到「返回可关闭句柄」的默认实现，供覆盖式反馈断言使用
  elMessage.mockReset();
  elMessage.mockImplementation(() => {
    const handler = { close: vi.fn() };
    handlers.push(handler);
    return handler;
  });
  closeAll.mockClear();
  handlers.length = 0;
});

describe("message util", () => {
  it("无参数调用走 pure-message 默认样式", () => {
    elMessage.mockReturnValue("handler");
    const result = message("hello");
    expect(result).toBe("handler");
    expect(elMessage).toHaveBeenCalledWith({
      message: "hello",
      customClass: "pure-message"
    });
  });

  it("antd 风格映射为 pure-message 并应用全部默认值", () => {
    message("hi", { type: "success" });
    expect(elMessage).toHaveBeenCalledWith({
      message: "hi",
      icon: undefined,
      type: "success",
      plain: false,
      dangerouslyUseHTMLString: false,
      duration: 2000,
      showClose: false,
      offset: 16,
      placement: "top",
      appendTo: document.body,
      grouping: false,
      repeatNum: 1,
      customClass: "pure-message",
      onClose: expect.any(Function)
    });
  });

  it("el 风格不追加自定义类", () => {
    message("hi", { customClass: "el" });
    expect(elMessage.mock.calls[0]?.[0]?.customClass).toBe("");
  });

  it("onClose 回调经包装透传", () => {
    const onClose = vi.fn();
    message("hi", { onClose });
    elMessage.mock.calls[0]?.[0]?.onClose?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("onClose 缺省时包装函数安全空跑", () => {
    message("hi", {});
    expect(() => elMessage.mock.calls[0]?.[0]?.onClose?.()).not.toThrow();
  });

  it("closeAllMessage 委托 ElMessage.closeAll", () => {
    closeAllMessage();
    expect(closeAll).toHaveBeenCalledTimes(1);
  });
});

describe("message 覆盖式反馈", () => {
  it("keyedMessage 同 key 覆盖：新消息展示前关闭旧句柄", () => {
    keyedMessage("k", "加载中", { duration: 0 });
    expect(handlers).toHaveLength(1);
    keyedMessage("k", "完成", { type: "success" });
    expect(handlers).toHaveLength(2);
    expect(handlers[0].close).toHaveBeenCalledTimes(1);
  });

  it("不同 key 互不影响；closeKeyedMessage 关闭并移除句柄（重复调用不再关闭）", () => {
    keyedMessage("a", "A");
    keyedMessage("b", "B");
    expect(handlers[0].close).not.toHaveBeenCalled();
    closeKeyedMessage("a");
    expect(handlers[0].close).toHaveBeenCalledTimes(1);
    closeKeyedMessage("a");
    expect(handlers[0].close).toHaveBeenCalledTimes(1);
  });

  it("withKeyedLoading 成功：先 loading（duration 0）后同 key 成功覆盖", async () => {
    const result = await withKeyedLoading("t", Promise.resolve(42), {
      loading: "提交中",
      success: r => `成功：${r}`
    });
    expect(result).toBe(42);
    expect(elMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ message: "提交中", duration: 0 })
    );
    expect(elMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ message: "成功：42", type: "success" })
    );
    expect(handlers[0].close).toHaveBeenCalledTimes(1);
  });

  it("withKeyedLoading 失败：展示错误消息并继续抛出", async () => {
    await expect(
      withKeyedLoading("t2", () => Promise.reject(new Error("网络异常")), {
        loading: "提交中"
      })
    ).rejects.toThrow("网络异常");
    expect(elMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ message: "网络异常", type: "error" })
    );
  });

  it("withKeyedLoading 无成功文案时收尾直接关闭加载态", async () => {
    await withKeyedLoading("t3", Promise.resolve(1), { loading: "稍候" });
    expect(handlers[0].close).toHaveBeenCalledTimes(1);
    expect(elMessage).toHaveBeenCalledTimes(1);
  });
});
