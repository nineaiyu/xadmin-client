import { describe, expect, it } from "vitest";

import { normalizeMenuRow } from "../normalize";

describe("normalizeMenuRow 详情形态归一（FE-DATA-P1-12）", () => {
  it("详情接口的对象形态 parent / meta.badge_type 归一为标量", () => {
    const row = normalizeMenuRow({
      pk: 9,
      name: "子菜单",
      // 详情接口 parent 下发 {pk} 对象（编辑回显「上级」依赖它）
      parent: { pk: 3 },
      menu_type: { value: 1, label: "菜单" },
      meta: {
        title: "子菜单",
        // badge_type 同样是 choices 对象形态
        badge_type: { value: "warning", label: "警告" },
        badge: "新"
      },
      model: [{ pk: "m1" }]
    });
    expect(row.parent).toBe(3);
    expect(row.menuType).toBe(1);
    expect(row.meta.badge_type).toBe("warning");
    expect(row.meta.badge).toBe("新");
    expect(row.modelPks).toEqual(["m1"]);
  });

  it("列表行标量形态保持不变；空 parent 归一为空", () => {
    const row = normalizeMenuRow({ pk: "1", name: "顶级", meta: {} });
    expect(row.parent ?? null).toBeNull();
    expect(row.menuType).toBe(0);
  });
});
