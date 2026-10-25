import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { responsiveStorageNameSpace, setConfig } from "@/config";
import {
  APPEARANCE_PACK_TYPE,
  APPEARANCE_PACK_VERSION,
  appearancePackFileName,
  buildAppearancePack,
  mergeAppearanceConfig,
  parseAppearancePack
} from "../appearancePack";

/**
 * 站点级外观包（导出 / 导入）格式守卫。
 *
 * 外观包 = `WEB_SITE_CONFIG` 站点配置同形的可迁移文件（扁平 PascalCase +
 * 类型信封）。导入是覆盖站点默认的破坏性动作，因此：
 *   1) 导出物剔除构建期键（Version / 存储命名空间——站点配置值不含它们）；
 *   2) 导入校验从严：未知键 / 值形态不符 / 版本过新整体拒绝，不做部分导入；
 *   3) 合并语义：包内键覆盖、未出现的键保留（站点既有配置不丢失）。
 */

const platformConfig = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../../public/platform-config.json"),
    "utf-8"
  )
) as Record<string, unknown>;

const SEED = {
  locale: { locale: "en" },
  layout: { darkMode: true, theme: "dark" },
  configure: { radius: "lg", navbarOrder: ["search", "language"] }
};

beforeEach(() => {
  localStorage.clear();
  setConfig(platformConfig);
  Object.entries(SEED).forEach(([namespace, value]) =>
    localStorage.setItem(
      `${responsiveStorageNameSpace()}${namespace}`,
      JSON.stringify(value)
    )
  );
});

describe("buildAppearancePack（导出）", () => {
  it("信封完整：类型 / 版本 / 导出时间与配置对象", () => {
    const pack = buildAppearancePack();
    expect(pack.type).toBe(APPEARANCE_PACK_TYPE);
    expect(pack.version).toBe(APPEARANCE_PACK_VERSION);
    expect(pack.exportedAt).toEqual(expect.any(String));
    expect(new Date(pack.exportedAt).getTime()).not.toBeNaN();
    expect(pack.config).toEqual(expect.any(Object));
  });

  it("剔除构建期键，其余键都是平台配置既有键", () => {
    const pack = buildAppearancePack();
    expect("Version" in pack.config).toBe(false);
    expect("ResponsiveStorageNameSpace" in pack.config).toBe(false);
    for (const key of Object.keys(pack.config)) {
      expect(key in platformConfig, `unexpected key: ${key}`).toBe(true);
    }
  });

  it("偏好取最新本地值（覆盖平台默认）", () => {
    const pack = buildAppearancePack();
    expect(pack.config.Radius).toBe("lg");
    expect(pack.config.DarkMode).toBe(true);
    expect(pack.config.Locale).toBe("en");
    expect(pack.config.NavbarOrder).toEqual(["search", "language"]);
  });
});

describe("parseAppearancePack（导入校验）", () => {
  it("导出 → 导入原样回读（round-trip）", () => {
    const pack = buildAppearancePack();
    const parsed = parseAppearancePack(JSON.stringify(pack));
    expect(parsed).toEqual({ ok: true, config: pack.config });
  });

  it("非 JSON / 信封类型不符 / 版本过新分别拒绝", () => {
    expect(parseAppearancePack("not json")).toEqual({
      ok: false,
      code: "invalid-json"
    });
    expect(
      parseAppearancePack(JSON.stringify({ type: "other", config: {} }))
    ).toEqual({ ok: false, code: "wrong-type" });
    expect(
      parseAppearancePack(
        JSON.stringify({ type: APPEARANCE_PACK_TYPE, version: 99, config: {} })
      )
    ).toEqual({ ok: false, code: "wrong-version" });
  });

  it("空配置 / 配置非对象拒绝", () => {
    const envelope = (config: unknown) =>
      JSON.stringify({ type: APPEARANCE_PACK_TYPE, version: 1, config });
    expect(parseAppearancePack(envelope({}))).toEqual({
      ok: false,
      code: "empty-config"
    });
    expect(parseAppearancePack(envelope(["DarkMode"]))).toEqual({
      ok: false,
      code: "empty-config"
    });
  });

  it("未知键整体拒绝并列出键名（不做部分导入）", () => {
    const parsed = parseAppearancePack(
      JSON.stringify({
        type: APPEARANCE_PACK_TYPE,
        version: 1,
        config: { DarkMode: true, NoSuchKey: 1, AnotherOne: 2 }
      })
    );
    expect(parsed).toMatchObject({
      ok: false,
      code: "unknown-keys",
      keys: ["NoSuchKey", "AnotherOne"]
    });
  });

  it("值形态与平台配置不符拒绝（布尔 / 数组 / 对象分型）", () => {
    const envelope = (config: Record<string, unknown>) =>
      JSON.stringify({ type: APPEARANCE_PACK_TYPE, version: 1, config });
    // DarkMode 平台默认是布尔
    expect(parseAppearancePack(envelope({ DarkMode: "yes" }))).toMatchObject({
      ok: false,
      code: "bad-value",
      key: "DarkMode"
    });
    // NavbarOrder 平台默认是数组
    expect(
      parseAppearancePack(envelope({ NavbarOrder: "search" }))
    ).toMatchObject({ ok: false, code: "bad-value", key: "NavbarOrder" });
    // WidgetPositions 平台默认是对象
    expect(
      parseAppearancePack(envelope({ WidgetPositions: ["notice"] }))
    ).toMatchObject({ ok: false, code: "bad-value", key: "WidgetPositions" });
    // 数值键接受数值（FontScaleCustom 平台默认是数字）
    expect(
      parseAppearancePack(envelope({ FontScaleCustom: 16 }))
    ).toMatchObject({ ok: true, config: { FontScaleCustom: 16 } });
  });

  it("构建期键静默剔除而非拒绝（高版本导出的包仍可导入）", () => {
    const parsed = parseAppearancePack(
      JSON.stringify({
        type: APPEARANCE_PACK_TYPE,
        version: 1,
        config: { DarkMode: true, Version: "9.9.9" }
      })
    );
    expect(parsed).toEqual({ ok: true, config: { DarkMode: true } });
  });
});

describe("mergeAppearanceConfig（合并语义）", () => {
  it("包内键覆盖现值，未出现的键保留", () => {
    const merged = mergeAppearanceConfig(
      { DarkMode: false, Title: "Old", SplitPanes: { left: 1 } },
      { DarkMode: true }
    );
    expect(merged).toEqual({
      DarkMode: true,
      Title: "Old",
      SplitPanes: { left: 1 }
    });
  });
});

describe("appearancePackFileName", () => {
  it("分钟精度时间戳命名", () => {
    expect(appearancePackFileName(new Date(2026, 9, 25, 9, 5))).toBe(
      "xadmin-appearance-pack-20261025-0905.json"
    );
  });
});
