import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { responsiveStorageNameSpace, setConfig } from "@/config";
import { buildPlatformConfigSnapshot } from "../preferenceDiff";

/**
 * 「复制偏好」导出格式守卫。
 *
 * 导出物是**完整的 platform-config.json 内容**（当前生效值 + 本地最新偏好），
 * 用户复制后可直接整文件覆盖，无需挑字段；因此必须满足：
 *   1) 键集与键序与平台配置完全一致（非偏好键如 Version / 存储命名空间一个不丢）；
 *   2) 偏好键由三命名空间摊平为 PascalCase（语言为 `Locale`，无分组残留）；
 *   3) 每个键都是平台配置既有键——键名漂移会让站点配置同步整包失败（缺 `Locale`）。
 */

const platformConfig = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../../public/platform-config.json"),
    "utf-8"
  )
) as Record<string, unknown>;

/** 抽样覆盖三命名空间（含分组名、语言、长短键名与数组/对象值） */
const SEED = {
  locale: { locale: "en" },
  layout: {
    layout: "vertical",
    theme: "dark",
    darkMode: true,
    sidebarStatus: false,
    epThemeColor: "#123456",
    themeColor: "dark",
    themeMode: "dark"
  },
  configure: {
    radius: "lg",
    navbarOrder: ["search", "language"],
    widgetPositions: { notice: "header" },
    shortcutLogoutKeys: "alt+q",
    sidebarWidth: 260
  }
};

beforeEach(() => {
  localStorage.clear();
  // 模拟装配期已加载 platform-config.json（命名空间与键序都取自它）
  setConfig(platformConfig);
  Object.entries(SEED).forEach(([namespace, value]) =>
    localStorage.setItem(
      `${responsiveStorageNameSpace()}${namespace}`,
      JSON.stringify(value)
    )
  );
});

describe("buildPlatformConfigSnapshot（复制偏好导出）", () => {
  it("键集与键序与平台配置一致（整文件覆盖不丢字段）", () => {
    const snapshot = buildPlatformConfigSnapshot();

    expect(Object.keys(snapshot)).toEqual(Object.keys(platformConfig));
    // 非偏好键原样带出：构建版本与本地存储命名空间
    expect(snapshot.Version).toBe(platformConfig.Version);
    expect(snapshot.ResponsiveStorageNameSpace).toBe(
      platformConfig.ResponsiveStorageNameSpace
    );
  });

  it("顶层无分组键，语言落到 Locale", () => {
    const snapshot = buildPlatformConfigSnapshot();

    expect(Object.keys(snapshot)).not.toContain("locale");
    expect(Object.keys(snapshot)).not.toContain("layout");
    expect(Object.keys(snapshot)).not.toContain("configure");
    expect(snapshot.Locale).toBe("en");
  });

  it("本地最新偏好覆盖对应键（camelCase 导出为 PascalCase，值原样保留）", () => {
    const snapshot = buildPlatformConfigSnapshot();

    expect(snapshot.Theme).toBe("dark");
    expect(snapshot.EpThemeColor).toBe("#123456");
    expect(snapshot.SidebarStatus).toBe(false);
    expect(snapshot.ShortcutLogoutKeys).toBe("alt+q");
    expect(snapshot.NavbarOrder).toEqual(["search", "language"]);
    expect(snapshot.WidgetPositions).toEqual({ notice: "header" });
    expect(snapshot.SidebarWidth).toBe(260);
    // 未被本地偏好覆盖的键保持平台配置当前值
    expect(snapshot.MenuSearchHistory).toBe(platformConfig.MenuSearchHistory);
  });

  it("导出的每个键都是平台配置既有键（可直接粘贴）", () => {
    const snapshot = buildPlatformConfigSnapshot();

    for (const key of Object.keys(snapshot)) {
      expect(key in platformConfig, `${key} 不在 platform-config.json 中`).toBe(
        true
      );
    }
  });

  it("存储未初始化时不抛错，回落平台配置当前值", () => {
    localStorage.clear();

    expect(buildPlatformConfigSnapshot()).toEqual(platformConfig);
  });
});
