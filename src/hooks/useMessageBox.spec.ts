import { beforeEach, describe, expect, it, vi } from "vitest";
import { closeMessageBox, useAlert, usePrompt } from "./useMessageBox";

const mocks = vi.hoisted(() => ({
  prompt: vi.fn(),
  alert: vi.fn(),
  close: vi.fn()
}));

vi.mock("element-plus/es/components/message-box/index.mjs", () => ({
  ElMessageBox: {
    prompt: mocks.prompt,
    alert: mocks.alert,
    close: mocks.close
  }
}));

vi.mock("@/plugins/i18n", () => ({
  i18n: { global: { t: (key: string) => `«${key}»` } }
}));

beforeEach(() => {
  mocks.prompt.mockReset();
  mocks.alert.mockReset();
  mocks.close.mockReset();
});

describe("usePrompt", () => {
  it("确认返回输入值，默认按钮文案取全局词条", async () => {
    mocks.prompt.mockResolvedValue({ value: "hello", action: "confirm" });
    const result = await usePrompt()("提示", "标题", {
      inputPattern: /\S+/
    });
    expect(result).toEqual({ value: "hello", action: "confirm" });
    expect(mocks.prompt).toHaveBeenCalledWith(
      "提示",
      "标题",
      expect.objectContaining({
        inputPattern: /\S+/,
        confirmButtonText: "«buttons.sure»",
        cancelButtonText: "«buttons.cancel»"
      })
    );
  });

  it("取消 / 关闭返回 null（调用方无需 try/catch）", async () => {
    mocks.prompt.mockRejectedValue("cancel");
    await expect(usePrompt()("提示", "标题")).resolves.toBeNull();
  });
});

describe("useAlert", () => {
  it("确认返回 true，关闭返回 false", async () => {
    mocks.alert.mockResolvedValueOnce("confirm");
    await expect(useAlert()("内容", "标题")).resolves.toBe(true);
    mocks.alert.mockRejectedValueOnce("close");
    await expect(useAlert()("内容", "标题")).resolves.toBe(false);
  });

  it("closeMessageBox 关闭当前消息框", () => {
    closeMessageBox();
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });
});
