import { describe, expect, it } from "vitest";

import { scrollBehavior } from "../router";

describe("router scrollBehavior", () => {
  it("有历史位置时恢复历史位置", () => {
    expect(
      scrollBehavior({} as never, { meta: {} } as never, { left: 10, top: 20 })
    ).toEqual({
      left: 10,
      top: 20
    });
  });

  it("来源页要求保存滚动位置时返回当前 top", () => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 88;
    expect(
      scrollBehavior(
        {} as never,
        { meta: { saveSrollTop: true } } as never,
        null
      )
    ).toEqual({
      left: 0,
      top: 88
    });
  });

  it("无历史位置且无需保存时同步返回 false（不再悬挂 Promise）", () => {
    const result = scrollBehavior({} as never, { meta: {} } as never, null);
    expect(result).toBe(false);
    expect(result).not.toBeInstanceOf(Promise);
  });
});
