import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storageLocal } from "@pureadmin/utils";
import { responsiveStorageNameSpace, setConfig } from "@/config";
import { hexToHslTriplet } from "@/utils/color";
import { applyBootTheme, resolveBootDarkMode } from "./bootTheme";

/**
 * 装配期主题应用（全屏路由 / 登录页无 Layout 的场景）：
 * `data-theme`（菜单皮肤）、`html.dark`（站点暗色）、`--primary`（自定义主色）
 * 三项必须在 mount 前落好，否则直开投屏 / 设计器时菜单与图表取色回退缺省。
 */
const NS = "xadmin-boot-test-";

const storeLayout = (layout: Record<string, unknown>) =>
  storageLocal().setItem(`${NS}layout`, layout);

beforeEach(() => {
  setConfig({ ResponsiveStorageNameSpace: NS });
  storageLocal().removeItem(`${NS}layout`);
  storageLocal().removeItem(`${NS}configure`);
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("--primary");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveBootDarkMode", () => {
  it("按 darkMode 判定（缺省浅色）", () => {
    expect(resolveBootDarkMode({})).toBe(false);
    expect(resolveBootDarkMode({ darkMode: true })).toBe(true);
  });

  it("themeMode=system 读系统偏好（不信任过期的 darkMode）", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true
    } as MediaQueryList);
    expect(resolveBootDarkMode({ themeMode: "system", darkMode: false })).toBe(
      true
    );
  });
});

describe("applyBootTheme", () => {
  it("深色站点：html.dark + data-theme + 自定义主色全部就位", () => {
    storeLayout({
      theme: "dark",
      darkMode: true,
      themeMode: "dark",
      themeColor: "custom",
      epThemeColor: "#ff0000"
    });

    applyBootTheme();

    const root = document.documentElement;
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.style.getPropertyValue("--primary")).toBe(
      hexToHslTriplet("#ff0000")
    );
  });

  it("浅色站点：未设 epThemeColor 时不写主色覆写", () => {
    storeLayout({ theme: "light", darkMode: false, themeMode: "light" });
    document.documentElement.style.setProperty("--primary", "stale");

    applyBootTheme();

    const root = document.documentElement;
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.getAttribute("data-theme")).toBe("light");
    // 主题色回落到默认主色：内联覆写必须撤除（避免残留上一次会话的色值）
    expect(root.style.getPropertyValue("--primary")).toBe("");
  });

  it("存储为空（首次访问）：按平台默认值落点，不抛错", () => {
    setConfig({
      ResponsiveStorageNameSpace: NS,
      Theme: "light",
      DarkMode: false
    });

    expect(() => applyBootTheme()).not.toThrow();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("幂等：重复调用结果一致（布局挂载后会再应用一次）", () => {
    storeLayout({ theme: "dark", darkMode: true, epThemeColor: "#006be6" });

    applyBootTheme();
    const first = document.documentElement.style.getPropertyValue("--primary");
    applyBootTheme();

    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(
      first
    );
    expect(responsiveStorageNameSpace()).toBe(NS);
  });
});
