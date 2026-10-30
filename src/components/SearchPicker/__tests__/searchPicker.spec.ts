import { describe, expect, it } from "vitest";

import { createSearchPicker, entityOfComponentName } from "../index";

describe("SearchPicker 组件名契约", () => {
  it("按 entity 生成具名组件（后端元数据按名取组件）", () => {
    expect(createSearchPicker("user").name).toBe("SearchUser");
    expect(createSearchPicker("dept").name).toBe("SearchDept");
    expect(createSearchPicker("menu").name).toBe("SearchMenu");
  });

  it("通知载荷的 component 字符串可反解 entity，未知名返回 undefined", () => {
    expect(entityOfComponentName("SearchRole")).toBe("role");
    expect(entityOfComponentName("SearchPost")).toBe("post");
    expect(entityOfComponentName("Unknown")).toBeUndefined();
  });
});
