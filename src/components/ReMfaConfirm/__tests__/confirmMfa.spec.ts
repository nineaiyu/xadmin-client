import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  props: null as null | {
    confirmType: string;
    resolve: (result: { expire_at: number | null }) => void;
    reject: () => void;
  }
}));

vi.mock("../src/index.vue", () => ({
  default: {
    props: ["confirmType", "resolve", "reject", "destroy"],
    setup(props: {
      confirmType: string;
      resolve: (result: { expire_at: number | null }) => void;
      reject: () => void;
    }) {
      captured.props = props;
      return () => null;
    }
  }
}));
vi.mock("@/plugins/i18n", () => ({ i18n: { install: vi.fn() } }));
vi.mock("@/plugins/elementPlus", () => ({ useElementPlus: vi.fn() }));

import { confirmMfa } from "../index";

describe("confirmMfa 命令式二次验证", () => {
  beforeEach(() => {
    captured.props = null;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("并发 412 只创建一个确认弹窗，共享同一个 Promise", () => {
    const first = confirmMfa("mfa");
    const second = confirmMfa("mfa");
    expect(second).toBe(first);
    expect(captured.props?.confirmType).toBe("mfa");
    captured.props?.resolve({ expire_at: 123 });
    return expect(first).resolves.toEqual({ expire_at: 123 });
  });

  it("验证完成后再次调用会创建新弹窗（pending 已复位）", async () => {
    const first = confirmMfa();
    captured.props?.resolve({ expire_at: null });
    await first;
    const second = confirmMfa();
    expect(second).not.toBe(first);
    captured.props?.resolve({ expire_at: null });
    await second;
  });

  it("用户取消以 mfa-confirm-cancelled 拒绝", async () => {
    const pending = confirmMfa("password");
    expect(captured.props?.confirmType).toBe("password");
    captured.props?.reject();
    await expect(pending).rejects.toThrow("mfa-confirm-cancelled");
  });
});
