import { describe, expect, it } from "vitest";

import { useMultiFrame } from "../useMultiFrame";

describe("useMultiFrame", () => {
  it("clearMap 清空模块级 iframe 缓存（登出/切换账号）", () => {
    const frame = useMultiFrame();
    frame.setMap("/a", { name: "A" });
    frame.setMap("/b", { name: "B" });
    expect(frame.getMap()).toHaveLength(2);
    frame.clearMap();
    expect(frame.getMap()).toEqual([]);
  });
});
