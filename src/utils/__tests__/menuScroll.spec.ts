import { describe, expect, it } from "vitest";
import { computeMenuScrollTop } from "../menuScroll";

const base = {
  itemTop: 0,
  itemHeight: 50,
  scrollTop: 0,
  viewportHeight: 400,
  scrollHeight: 2000
};

describe("computeMenuScrollTop", () => {
  it("激活项完整可见时不滚动", () => {
    expect(computeMenuScrollTop({ ...base, itemTop: 100 })).toBeNull();
  });

  it("恰好贴合上下边界不滚动", () => {
    expect(computeMenuScrollTop({ ...base, itemTop: 0 })).toBeNull();
    expect(
      computeMenuScrollTop({
        ...base,
        itemTop: 350,
        scrollTop: 0,
        viewportHeight: 400
      })
    ).toBeNull();
  });

  it("向上越界：项顶对齐容器顶", () => {
    expect(
      computeMenuScrollTop({ ...base, itemTop: 120, scrollTop: 300 })
    ).toBe(120);
  });

  it("向下越界：项底对齐容器底", () => {
    // 项 1000..1050，可视区 0..400 → 目标 650
    expect(computeMenuScrollTop({ ...base, itemTop: 1000 })).toBe(650);
  });

  it("越界目标钳制到内容范围（顶部不越界、底部不超滚）", () => {
    expect(
      computeMenuScrollTop({ ...base, itemTop: -20, scrollTop: 100 })
    ).toBe(0);
    expect(
      computeMenuScrollTop({
        ...base,
        itemTop: 1990,
        itemHeight: 50,
        scrollHeight: 2000
      })
    ).toBe(1600);
  });

  it("容器不可滚动（内容不超可视区）时返回 null", () => {
    expect(
      computeMenuScrollTop({
        ...base,
        scrollHeight: 300,
        viewportHeight: 400,
        itemTop: 100
      })
    ).toBeNull();
  });

  it("视口高度为 0（隐藏态）时返回 null", () => {
    expect(
      computeMenuScrollTop({ ...base, viewportHeight: 0, itemTop: 500 })
    ).toBeNull();
  });
});
