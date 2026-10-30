import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/fetchAllRows", () => ({
  fetchAllRows: vi.fn(() => Promise.reject(new Error("network")))
}));

import {
  buildDashboardShareUrl,
  fetchDashboardDatasets,
  resolveInitialDashboard
} from "../dashboardViewState";

describe("仪表盘展示态纯函数", () => {
  it("?pk= 命中分享目标，否则回落首个仪表盘；空清单返回 null", () => {
    const rows = [{ pk: "a" }, { pk: "b" }] as never;
    expect(resolveInitialDashboard(rows, "b")?.pk).toBe("b");
    expect(resolveInitialDashboard(rows, "missing")?.pk).toBe("a");
    expect(resolveInitialDashboard([], "a")).toBeNull();
  });

  it("分享链接按 hash / h5 路由模式生成，不硬编码 hash", () => {
    const h5 = {
      resolve: () => ({ href: "/dashboard?pk=x" })
    };
    expect(
      buildDashboardShareUrl(
        h5 as never,
        { path: "/dashboard", query: {} } as never,
        "x",
        "https://console.example.com"
      )
    ).toBe("https://console.example.com/dashboard?pk=x");

    const hash = { resolve: () => ({ href: "#/dashboard?pk=x" }) };
    expect(
      buildDashboardShareUrl(
        hash as never,
        { path: "/dashboard", query: {} } as never,
        "x",
        "https://console.example.com"
      )
    ).toBe("https://console.example.com/#/dashboard?pk=x");
  });

  it("数据集下拉失败返回 null（由调用方显式提示，不伪装成空目录）", async () => {
    expect(await fetchDashboardDatasets()).toBeNull();
  });
});
