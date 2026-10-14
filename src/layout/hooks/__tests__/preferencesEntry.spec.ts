import { describe, expect, it } from "vitest";

import { resolvePreferencesEntry } from "../preferencesEntry";

/**
 * 设置入口形态矩阵：核心不变式是「任何组合都有可发现的入口」——
 * 显眼入口全关时头像菜单项必须为真（否则用户只能清本地存储找回面板）。
 */
describe("resolvePreferencesEntry", () => {
  it("默认（开启 + 跟随布局）：竖排走顶栏齿轮", () => {
    expect(resolvePreferencesEntry({})).toEqual({
      header: true,
      floating: false,
      dropdown: false
    });
  });

  it("auto 档：水平布局走悬浮球，其余走顶栏齿轮", () => {
    expect(
      resolvePreferencesEntry({ preferencesPosition: "auto", horizontal: true })
    ).toEqual({ header: false, floating: true, dropdown: false });
    expect(
      resolvePreferencesEntry({
        preferencesPosition: "auto",
        horizontal: false
      })
    ).toEqual({ header: true, floating: false, dropdown: false });
  });

  it("fixed 档恒为悬浮球；header 档恒为顶栏齿轮", () => {
    expect(resolvePreferencesEntry({ preferencesPosition: "fixed" })).toEqual({
      header: false,
      floating: true,
      dropdown: false
    });
    expect(resolvePreferencesEntry({ preferencesPosition: "header" })).toEqual({
      header: true,
      floating: false,
      dropdown: false
    });
  });

  it("全屏内容模式顶栏不存在：任何位置档都回落悬浮球", () => {
    expect(
      resolvePreferencesEntry({
        preferencesPosition: "header",
        fullContent: true
      })
    ).toEqual({ header: false, floating: true, dropdown: false });
  });

  it("不显示 / 总开关关闭 / 头像菜单档：只保留头像菜单兜底项", () => {
    const fallback = { header: false, floating: false, dropdown: true };
    expect(resolvePreferencesEntry({ preferencesPosition: "none" })).toEqual(
      fallback
    );
    expect(resolvePreferencesEntry({ enablePreferences: false })).toEqual(
      fallback
    );
    expect(
      resolvePreferencesEntry({
        enablePreferences: false,
        preferencesPosition: "fixed"
      })
    ).toEqual(fallback);
    expect(
      resolvePreferencesEntry({ preferencesPosition: "user-dropdown" })
    ).toEqual(fallback);
  });

  it("不变式：任何组合下至少有一个入口可用", () => {
    const positions = [
      "auto",
      "header",
      "fixed",
      "user-dropdown",
      "none",
      "unknown"
    ];
    for (const enablePreferences of [true, false]) {
      for (const preferencesPosition of positions) {
        for (const horizontal of [true, false]) {
          for (const fullContent of [true, false]) {
            const state = resolvePreferencesEntry({
              enablePreferences,
              preferencesPosition,
              horizontal,
              fullContent
            });
            expect(
              state.header || state.floating || state.dropdown,
              `${enablePreferences}/${preferencesPosition}/${horizontal}/${fullContent}`
            ).toBe(true);
          }
        }
      }
    }
  });
});
