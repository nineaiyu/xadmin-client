import { beforeEach, describe, expect, it, vi } from "vitest";

const { elMessage, closeAll } = vi.hoisted(() => ({
  elMessage: vi.fn(),
  closeAll: vi.fn()
}));

vi.mock("element-plus", () => ({
  ElMessage: Object.assign(elMessage, { closeAll })
}));

import { closeAllMessage, message } from "../message";

describe("message util", () => {
  beforeEach(() => {
    elMessage.mockClear();
    closeAll.mockClear();
  });

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
    expect(elMessage.mock.calls[0][0].customClass).toBe("");
  });

  it("onClose 回调经包装透传", () => {
    const onClose = vi.fn();
    message("hi", { onClose });
    elMessage.mock.calls[0][0].onClose();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("onClose 缺省时包装函数安全空跑", () => {
    message("hi", {});
    expect(() => elMessage.mock.calls[0][0].onClose()).not.toThrow();
  });

  it("closeAllMessage 委托 ElMessage.closeAll", () => {
    closeAllMessage();
    expect(closeAll).toHaveBeenCalledTimes(1);
  });
});
