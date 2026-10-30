import { describe, expect, it } from "vitest";

import { i18n, transformI18n } from "@/plugins/i18n";

describe("transformI18n", () => {
  it("解析点分叶子 key 为译文", () => {
    i18n.global.locale = "zh";
    expect(transformI18n("results.copySuccess")).toBe("复制成功");
    expect(transformI18n("login.logoutSuccess")).toBe("登出成功");
    expect(transformI18n("layout.saveConfigSuccess")).toBeTruthy();
  });

  it("普通含点文本原样返回", () => {
    expect(transformI18n("5.0.2")).toBe("5.0.2");
    expect(transformI18n("a.b.c")).toBe("a.b.c");
  });

  it("对象形态按当前语言取值", () => {
    i18n.global.locale = "zh";
    expect(transformI18n({ zh: "中文", en: "English" })).toBe("中文");
  });
});
