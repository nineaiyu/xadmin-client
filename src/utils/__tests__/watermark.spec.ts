import { describe, expect, it } from "vitest";

import {
  buildWatermarkText,
  defaultSiteWatermark,
  formatWatermarkTime,
  isSiteWatermarkVisible,
  isWatermarkPath,
  parseWatermarkPaths
} from "../watermark";

describe("站点水印配置解析", () => {
  it("默认配置未开启且范围为全部页面", () => {
    expect(defaultSiteWatermark).toEqual({
      enabled: false,
      text: "",
      paths: []
    });
    expect(
      isWatermarkPath("/system/user/index", defaultSiteWatermark.paths)
    ).toBe(true);
  });

  it("逗号分隔路径解析：容忍中英文逗号与空白且忽略空项", () => {
    expect(
      parseWatermarkPaths(" /system/user/index ,/system/role/index， , ")
    ).toEqual(["/system/user/index", "/system/role/index"]);
    expect(parseWatermarkPaths("")).toEqual([]);
    expect(parseWatermarkPaths(null)).toEqual([]);
    expect(parseWatermarkPaths(undefined)).toEqual([]);
  });

  it("生效范围按路径前缀匹配（敏感页面）", () => {
    const paths = ["/system/user/index", "/system/approval"];
    expect(isWatermarkPath("/system/user/index", paths)).toBe(true);
    expect(isWatermarkPath("/system/approval", paths)).toBe(true);
    // 前缀匹配：子路由同样生效
    expect(isWatermarkPath("/system/approval/instance/index", paths)).toBe(
      true
    );
    expect(isWatermarkPath("/system/role/index", paths)).toBe(false);
    expect(isWatermarkPath("/analysis/dashboard/index", paths)).toBe(false);
  });
});

describe("站点水印展示判定（菜单级开关 + 路径范围）", () => {
  const outside = {
    enabled: true,
    paths: ["/system/user/index"],
    path: "/analysis/dashboard/index"
  };

  it("总开关关闭或登录页一律不展示", () => {
    expect(isSiteWatermarkVisible({ ...outside, enabled: false })).toBe(false);
    expect(isSiteWatermarkVisible({ ...outside, onLoginPage: true })).toBe(
      false
    );
  });

  it("路径前缀范围命中即展示（既有行为不变）", () => {
    expect(
      isSiteWatermarkVisible({
        enabled: true,
        paths: ["/system"],
        path: "/system/user/index"
      })
    ).toBe(true);
    expect(isSiteWatermarkVisible(outside)).toBe(false);
  });

  it("菜单级开关为或关系：范围外页面置顶强制展示", () => {
    expect(isSiteWatermarkVisible({ ...outside, menuWatermark: true })).toBe(
      true
    );
    // 范围内页面即使菜单开关关闭也照常展示（开关不承担排除语义）
    expect(
      isSiteWatermarkVisible({
        enabled: true,
        paths: ["/system"],
        path: "/system/user/index",
        menuWatermark: false
      })
    ).toBe(true);
  });
});

describe("水印文案与时间戳", () => {
  it("时间戳为分钟粒度 YYYY-MM-DD HH:mm", () => {
    expect(formatWatermarkTime(new Date(2026, 8, 13, 9, 5))).toBe(
      "2026-09-13 09:05"
    );
    expect(formatWatermarkTime(new Date(2026, 11, 31, 23, 59))).toBe(
      "2026-12-31 23:59"
    );
  });

  it("默认文案 = 用户名-昵称-时间；无昵称时省略昵称段", () => {
    const time = "2026-09-13 10:00";
    expect(
      buildWatermarkText({ username: "admin", nickname: "超管", time })
    ).toBe("admin-超管-2026-09-13 10:00");
    expect(buildWatermarkText({ username: "admin", time })).toBe(
      "admin-2026-09-13 10:00"
    );
  });

  it("自定义文案仍拼接时间（保留可追溯性）", () => {
    expect(
      buildWatermarkText({
        username: "admin",
        nickname: "超管",
        customText: "内部资料",
        time: "2026-09-13 10:00"
      })
    ).toBe("内部资料-2026-09-13 10:00");
  });
});
