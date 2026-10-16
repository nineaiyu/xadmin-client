import { describe, expect, it } from "vitest";

import {
  COMPACT_SCROLL_HEIGHT,
  DESKTOP_CONTAINER_MIN_HEIGHT,
  DESKTOP_SCROLL_HEIGHT
} from "../userTreeHeight";

/**
 * UserTree 高度口径守护：三处高度曾以裸字符串散落模板，收敛到
 * utils/userTreeHeight.ts 后在此钉住字面值——任何调整都必须显式改这里，
 * 并同步目检「用户管理」桌面/移动端两形态（移动端守护另见 mobile.e2e）。
 */
describe("userTreeHeight 高度口径", () => {
  it("三处高度字面值与既有布局保持一致", () => {
    expect(DESKTOP_CONTAINER_MIN_HEIGHT).toBe("calc(100vh - 141px)");
    expect(DESKTOP_SCROLL_HEIGHT).toBe("calc(90vh - 108px)");
    expect(COMPACT_SCROLL_HEIGHT).toBe("min(32vh, 260px)");
  });

  it("桌面容器与滚动区是两个独立调校的盒子，公式不可互相吞并", () => {
    // 容器按 100vh 铺满、滚动区按 90vh 预留富余，历史口径即不同；
    // 若有人把两者改成同一公式，说明未读推导注释，先在此停下确认。
    expect(DESKTOP_CONTAINER_MIN_HEIGHT).not.toBe(DESKTOP_SCROLL_HEIGHT);
    expect(DESKTOP_CONTAINER_MIN_HEIGHT).toContain("100vh");
    expect(DESKTOP_SCROLL_HEIGHT).toContain("90vh");
  });

  it("堆叠形态滚动区必须限高（保证用户列表留在首屏）", () => {
    expect(COMPACT_SCROLL_HEIGHT).toContain("260px");
    expect(COMPACT_SCROLL_HEIGHT).toContain("vh");
  });
});
