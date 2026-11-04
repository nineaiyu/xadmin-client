import { describe, expect, it } from "vitest";

import {
  COMPACT_SCROLL_HEIGHT,
  DESKTOP_CONTAINER_MIN_HEIGHT,
  DESKTOP_SCROLL_HEIGHT
} from "../userTreeHeight";

/**
 * UserTree 高度口径守护：三处高度曾以裸字符串散落模板，收敛到
 * utils/userTreeHeight.ts 后在此钉住口径——任何调整都必须显式改这里，
 * 并同步目检「用户管理」桌面/移动端两形态（移动端守护另见 mobile.e2e）。
 */
describe("userTreeHeight 高度口径", () => {
  it("容器地板消费 --layout-chrome-h（随隐藏页签/顶栏偏好自适应）", () => {
    // 旧口径是按默认 chrome 校准的 141px 魔数；新口径 = chrome 令牌 + 页面
    // 私有 50px（默认 chrome 91px 下与旧值逐像素一致：91 + 50 = 141）
    expect(DESKTOP_CONTAINER_MIN_HEIGHT).toContain("var(--layout-chrome-h)");
    expect(DESKTOP_CONTAINER_MIN_HEIGHT).toContain("- 50px");
    expect(DESKTOP_CONTAINER_MIN_HEIGHT).not.toContain("141px");
  });

  it("vh/dvh 双写（移动端动态工具栏兜底，不支持 dvh 时回落 vh）", () => {
    for (const value of [
      DESKTOP_CONTAINER_MIN_HEIGHT,
      DESKTOP_SCROLL_HEIGHT,
      COMPACT_SCROLL_HEIGHT
    ]) {
      expect(value).toMatch(/\d+vh/);
      expect(value).toMatch(/\d+dvh/);
      // 同一属性名成对出现（CSS 级联取后者；vh/dvh 可位于声明中段）
      expect(value).toMatch(/height: [^;]*\d+vh[^;]*;[^;]*height: [^;]*\d+dvh/);
    }
  });

  it("桌面容器与滚动区是两个独立调校的盒子，公式不可互相吞并", () => {
    // 容器按视口铺满、滚动区按 90vh 预留富余，历史口径即不同；
    // 若有人把两者改成同一公式，说明未读推导注释，先在此停下确认。
    expect(DESKTOP_CONTAINER_MIN_HEIGHT).not.toBe(DESKTOP_SCROLL_HEIGHT);
    expect(DESKTOP_CONTAINER_MIN_HEIGHT).toContain("100vh");
    expect(DESKTOP_SCROLL_HEIGHT).toContain("90vh");
    expect(DESKTOP_SCROLL_HEIGHT).toContain("108px");
  });

  it("堆叠形态滚动区必须限高（保证用户列表留在首屏）", () => {
    expect(COMPACT_SCROLL_HEIGHT).toContain("260px");
    expect(COMPACT_SCROLL_HEIGHT).toContain("32vh");
  });
});
