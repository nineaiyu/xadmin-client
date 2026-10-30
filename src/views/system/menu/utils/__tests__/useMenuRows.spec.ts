import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/fetchAllRows", () => ({ fetchAllRows: mocks.list }));
vi.mock("@/utils/metaCache", () => ({
  fetchMetaList: (_key: string, loader: () => unknown) => loader(),
  META_KEYS: { menu: "menu" }
}));

import { useMenuRows } from "../useMenuRows";

describe("useMenuRows 失败态", () => {
  it("成功时清空错误并落数据", async () => {
    mocks.list.mockResolvedValue({
      code: 1000,
      data: { results: [{ pk: "1", name: "系统管理" }] }
    });
    const rows = useMenuRows({ list: mocks.list } as never);
    await rows.getMenuData();
    expect(rows.loadError.value).toBe("");
    expect(rows.rawRows.value).toHaveLength(1);
  });

  it("业务失败记录 detail（树区渲染错误态而不是空树）", async () => {
    mocks.list.mockResolvedValue({ code: 1001, detail: "permission denied" });
    const rows = useMenuRows({ list: mocks.list } as never);
    await rows.getMenuData();
    expect(rows.loadError.value).toBe("permission denied");
    expect(rows.loading.value).toBe(false);
  });

  it("网络异常经 normalizeError 归一为可读错误", async () => {
    mocks.list.mockRejectedValue({ detail: "gateway timeout" });
    const rows = useMenuRows({ list: mocks.list } as never);
    await rows.getMenuData();
    expect(rows.loadError.value).toBe("gateway timeout");
  });
});
