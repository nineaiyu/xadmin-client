import { afterEach, describe, expect, it, vi } from "vitest";

const { messageMock } = vi.hoisted(() => ({ messageMock: vi.fn() }));

vi.mock("@/utils/message", () => ({ message: messageMock }));
vi.mock("@/plugins/i18n", () => ({
  transformI18n: (key: string) => key
}));

import { copyText, writeClipboardText } from "./clipboard";

const writeTextMock = vi.fn();

function stubClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value,
    configurable: true
  });
}

function stubExecCommand(impl: () => boolean) {
  const execCommandMock = vi.fn(impl);
  Object.defineProperty(document, "execCommand", {
    value: execCommandMock,
    configurable: true
  });
  return execCommandMock;
}

describe("writeClipboardText", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    stubClipboard(undefined);
    Object.defineProperty(document, "execCommand", {
      value: undefined,
      configurable: true
    });
    document.body.innerHTML = "";
  });

  it("Clipboard API 可用时直接写入", async () => {
    writeTextMock.mockResolvedValue(undefined);
    stubClipboard({ writeText: writeTextMock });
    await expect(writeClipboardText("hello")).resolves.toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith("hello");
  });

  it("Clipboard API 不可用时回退 execCommand", async () => {
    stubClipboard(undefined);
    const execCommandMock = stubExecCommand(() => true);
    await expect(writeClipboardText("hello")).resolves.toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith("copy");
    expect(document.body.querySelectorAll("textarea")).toHaveLength(0);
  });

  it("Clipboard API 写入被拒时回退 execCommand", async () => {
    writeTextMock.mockRejectedValue(new Error("denied"));
    stubClipboard({ writeText: writeTextMock });
    const execCommandMock = stubExecCommand(() => true);
    await expect(writeClipboardText("hello")).resolves.toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith("copy");
  });

  it("两条路径都失败返回 false", async () => {
    writeTextMock.mockRejectedValue(new Error("denied"));
    stubClipboard({ writeText: writeTextMock });
    stubExecCommand(() => false);
    await expect(writeClipboardText("hello")).resolves.toBe(false);
  });
});

describe("copyText", () => {
  afterEach(() => {
    stubClipboard(undefined);
    Object.defineProperty(document, "execCommand", {
      value: undefined,
      configurable: true
    });
  });

  it("成功提示 results.copySuccess（success 档）", async () => {
    writeTextMock.mockResolvedValue(undefined);
    stubClipboard({ writeText: writeTextMock });
    await expect(copyText("hello")).resolves.toBe(true);
    expect(messageMock).toHaveBeenCalledWith("results.copySuccess", {
      type: "success"
    });
  });

  it("失败提示 results.copyFailed（error 档）", async () => {
    stubClipboard(undefined);
    stubExecCommand(() => false);
    await expect(copyText("hello")).resolves.toBe(false);
    expect(messageMock).toHaveBeenCalledWith("results.copyFailed", {
      type: "error"
    });
  });

  it("失败且给出降级文案时以 info 档展示降级内容", async () => {
    stubClipboard(undefined);
    stubExecCommand(() => false);
    await copyText("hello", { failureFallbackText: "https://x.example" });
    expect(messageMock).toHaveBeenCalledWith("https://x.example", {
      type: "info",
      duration: 5000
    });
  });

  it("自定义文案覆盖默认口径", async () => {
    writeTextMock.mockResolvedValue(undefined);
    stubClipboard({ writeText: writeTextMock });
    await copyText("hello", { successText: "已复制" });
    expect(messageMock).toHaveBeenCalledWith("已复制", { type: "success" });
  });
});
