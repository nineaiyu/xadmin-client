import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/useConfirm", () => ({ useConfirm: () => vi.fn() }));

import { useAuthorizedAppList } from "../useAuthorizedAppList";
import type { AuthorizedApplication } from "@/api/user/authorizedApp";

const api = (list: () => Promise<unknown>) => ({
  list: list as () => Promise<never>,
  revoke: vi.fn()
});

describe("已授权应用加载失败态", () => {
  it("请求异常时保留错误原因并清空行，便于重试", async () => {
    const { error, rows, load } = useAuthorizedAppList({
      api: api(() => Promise.reject(new Error("network down"))),
      confirmKey: "authorizedApps.revokeConfirm",
      successKey: "authorizedApps.revoked"
    });

    await load();

    expect(error.value).toBe("network down");
    expect(rows.value).toEqual([]);
  });

  it("业务码失败同样归入错误态", async () => {
    const { error, load } = useAuthorizedAppList({
      api: api(() =>
        Promise.resolve({ code: 1001, detail: "无权限", data: null })
      ),
      confirmKey: "authorizedApps.revokeConfirm",
      successKey: "authorizedApps.revoked"
    });

    await load();

    expect(error.value).toBe("无权限");
  });

  it("成功加载清空错误并回写行", async () => {
    const row = {
      application: { pk: "a1", name: "App" }
    } as AuthorizedApplication;
    const { error, rows, load } = useAuthorizedAppList({
      api: api(() =>
        Promise.resolve({ code: 1000, data: { results: [row], total: 1 } })
      ),
      confirmKey: "authorizedApps.revokeConfirm",
      successKey: "authorizedApps.revoked"
    });

    await load();

    expect(error.value).toBe("");
    expect(rows.value).toEqual([row]);
  });
});
