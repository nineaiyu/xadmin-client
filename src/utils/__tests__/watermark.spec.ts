import { describe, expect, it } from "vitest";

import type { SiteWatermarkResultConfig } from "@/api/auth";

import {
  buildWatermarkRenderOptions,
  DEFAULT_WATERMARK_TEMPLATE,
  defaultSiteWatermark,
  formatWatermarkTime,
  isSiteWatermarkVisible,
  isWatermarkPath,
  parseWatermarkPaths,
  renderWatermarkText,
  toSiteWatermarkConfig
} from "../watermark";

describe("站点水印配置解析", () => {
  it("默认配置未开启且范围为全部页面", () => {
    expect(defaultSiteWatermark).toEqual({
      enabled: false,
      template: "",
      paths: [],
      fontSize: 16,
      opacity: 0.3,
      rotate: -10,
      color: ""
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

  it("config 载荷解析：缺省样式字段回落默认值", () => {
    expect(toSiteWatermarkConfig(undefined)).toEqual(defaultSiteWatermark);
    expect(
      toSiteWatermarkConfig({ FRONT_END_WEB_WATERMARK_ENABLED: true })
    ).toEqual({
      enabled: true,
      template: "",
      paths: [],
      fontSize: 16,
      opacity: 0.3,
      rotate: -10,
      color: ""
    });
  });

  it("config 载荷解析：非法样式值夹紧到合法区间", () => {
    const config: SiteWatermarkResultConfig = {
      FRONT_END_WEB_WATERMARK_ENABLED: true,
      FRONT_END_WEB_WATERMARK_TEXT: "内部资料",
      FRONT_END_WEB_WATERMARK_PATHS: "/system/user/index,/system/role/index",
      FRONT_END_WEB_WATERMARK_FONT_SIZE: 999,
      FRONT_END_WEB_WATERMARK_OPACITY: 0,
      FRONT_END_WEB_WATERMARK_ROTATE: 120,
      FRONT_END_WEB_WATERMARK_COLOR: "#909399"
    };
    expect(toSiteWatermarkConfig(config)).toEqual({
      enabled: true,
      template: "内部资料",
      paths: ["/system/user/index", "/system/role/index"],
      fontSize: 72,
      opacity: 0.01,
      rotate: 90,
      color: "#909399"
    });
  });

  it("渲染属性按配置生成（字号/透明度/旋转角/颜色）", () => {
    expect(
      buildWatermarkRenderOptions({
        ...defaultSiteWatermark,
        fontSize: 24,
        opacity: 0.15,
        rotate: -45,
        color: "#ff0000"
      })
    ).toEqual({
      font: "normal 24px Arial, 'Courier New', 'Droid Sans', sans-serif",
      globalAlpha: 0.15,
      rotate: -45,
      color: "#ff0000",
      verticalOffset: 170
    });
    // 颜色留空不传 color：回落 useWatermark 内置默认灰
    expect(buildWatermarkRenderOptions(defaultSiteWatermark).color).toBe(
      undefined
    );
  });

  it("生效范围按路径前缀匹配（敏感页面）", () => {
    const paths = ["/system/user/index", "/approval"];
    expect(isWatermarkPath("/system/user/index", paths)).toBe(true);
    expect(isWatermarkPath("/approval", paths)).toBe(true);
    // 前缀匹配：子路由同样生效
    expect(isWatermarkPath("/approval/instance/index", paths)).toBe(true);
    expect(isWatermarkPath("/system/role/index", paths)).toBe(false);
    expect(isWatermarkPath("/analysis/dashboard/index", paths)).toBe(false);
  });
});

describe("水印文案模板渲染", () => {
  const time = "2026-10-03 21:00";
  const vars = {
    username: "alice",
    nickname: "爱丽丝",
    phone: "13800000000",
    email: "a@x.com",
    pk: 42,
    time
  };

  it("空模板回落默认模板 {username}-{nickname}-{time}", () => {
    expect(renderWatermarkText("", vars)).toBe("alice-爱丽丝-2026-10-03 21:00");
    expect(renderWatermarkText("   ", vars)).toBe(
      "alice-爱丽丝-2026-10-03 21:00"
    );
    expect(DEFAULT_WATERMARK_TEMPLATE).toBe("{username}-{nickname}-{time}");
  });

  it("占位符按当前用户变量解析（手机号/邮箱/唯一标识）", () => {
    expect(renderWatermarkText("{username}-{phone}-{time}", vars)).toBe(
      "alice-13800000000-2026-10-03 21:00"
    );
    expect(renderWatermarkText("{nickname}<{email}>", vars)).toBe(
      "爱丽丝<a@x.com>"
    );
    expect(renderWatermarkText("ID:{pk}", vars)).toBe("ID:42");
  });

  it("缺失占位符替换为空串并合并产生的连续连字符", () => {
    // 无昵称：默认模板不出现双连字符（与旧行为一致）
    expect(renderWatermarkText("", { ...vars, nickname: "" })).toBe(
      "alice-2026-10-03 21:00"
    );
    // 无手机号：占位符与相邻连字符一起消失
    expect(
      renderWatermarkText("{username}-{phone}-{time}", { ...vars, phone: "" })
    ).toBe("alice-2026-10-03 21:00");
  });

  it("未知占位符剔除，纯文本模板原样保留", () => {
    expect(renderWatermarkText("内部资料-{unknown}-{time}", vars)).toBe(
      "内部资料-2026-10-03 21:00"
    );
    expect(renderWatermarkText("内部资料、禁止外传", vars)).toBe(
      "内部资料、禁止外传"
    );
  });

  it("time 缺省时取当前分钟粒度时间", () => {
    expect(renderWatermarkText("{username}-{time}", { username: "bob" })).toBe(
      `bob-${formatWatermarkTime()}`
    );
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

describe("水印时间戳", () => {
  it("时间戳为分钟粒度 YYYY-MM-DD HH:mm", () => {
    expect(formatWatermarkTime(new Date(2026, 8, 13, 9, 5))).toBe(
      "2026-09-13 09:05"
    );
    expect(formatWatermarkTime(new Date(2026, 11, 31, 23, 59))).toBe(
      "2026-12-31 23:59"
    );
  });
});
