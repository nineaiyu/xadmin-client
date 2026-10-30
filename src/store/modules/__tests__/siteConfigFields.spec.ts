import { describe, expect, it } from "vitest";
import {
  PREFERENCE_FIELDS,
  localPreferenceSections,
  serverPreferenceConfig
} from "../siteConfigFields";

describe("preference registry", () => {
  it("注册表键唯一（同一服务端键/本地键不得重复登记）", () => {
    const serverKeys = PREFERENCE_FIELDS.map(item => item.serverKey);
    const localKeys = PREFERENCE_FIELDS.map(
      item => `${item.section}.${item.localKey}`
    );
    expect(new Set(serverKeys).size).toBe(serverKeys.length);
    expect(new Set(localKeys).size).toBe(localKeys.length);
  });

  it("本地三段 ↔ 服务端扁平键可无损往返", () => {
    const config: Record<string, unknown> = {};
    for (const field of PREFERENCE_FIELDS) {
      config[field.serverKey] = `v-${field.serverKey}`;
    }
    const sections = localPreferenceSections(config);
    const roundTrip = serverPreferenceConfig(sections);
    expect(roundTrip).toEqual(config);
  });

  it("缺键回落注册表缺省值（Locale 缺失不再整包失效）", () => {
    const sections = localPreferenceSections({});
    expect(sections.locale.locale).toBe("zh");
    expect(sections.layout.layout).toBe("vertical");
    expect(sections.configure.sidebarWidth).toBe(224);
  });

  it("ThemeColor 缺省跟随 Theme", () => {
    const sections = localPreferenceSections({ Theme: "dark" });
    expect(sections.layout.themeColor).toBe("dark");
  });
});
