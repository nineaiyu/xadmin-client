import { describe, expect, it } from "vitest";
import { referencedDashboardIds } from "./screenReferences";

/**
 * 投屏装载的仪表盘清单 = 轮播清单 ∪ 画布窗格引用。
 * 只按清单装载时，「画布引用了未进清单的仪表盘」会被可见性过滤整格丢掉。
 */
const screen = (extra: Record<string, unknown> = {}) =>
  ({
    pk: "s1",
    name: "大屏",
    dashboards: ["d1", "d1", ""],
    layout: [
      { pk: "p1", type: "dashboard", dashboard: "d2" },
      { pk: "p2", type: "metric", dataset: "ds1" }
    ],
    free_layout: { panes: [{ pk: "p3", type: "dashboard", dashboard: "d3" }] },
    ...extra
  }) as never;

describe("referencedDashboardIds", () => {
  it("并集去重：轮播清单 + 栅格窗格 + 自由窗格", () => {
    expect(referencedDashboardIds(screen()).sort()).toEqual(["d1", "d2", "d3"]);
  });

  it("metric 窗格不贡献仪表盘 id", () => {
    const ids = referencedDashboardIds(
      screen({
        dashboards: [],
        layout: [{ type: "metric", dataset: "ds" }],
        free_layout: null
      })
    );
    expect(ids).toEqual([]);
  });

  it("空载荷与坏形态安全返回", () => {
    expect(referencedDashboardIds(null)).toEqual([]);
    expect(referencedDashboardIds({} as never)).toEqual([]);
    expect(
      referencedDashboardIds({
        dashboards: null,
        layout: [null, 1, { type: "dashboard" }],
        free_layout: null
      } as never)
    ).toEqual([]);
  });

  it("自由画布为字符串/坏 JSON 时不抛错", () => {
    expect(
      referencedDashboardIds(screen({ layout: [], free_layout: "not-json" }))
    ).toEqual(["d1"]);
  });
});
