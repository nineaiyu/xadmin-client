import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PREFERENCE_FIELDS } from "../siteConfigFields";

/**
 * 站点配置的读写映射由 siteConfigFields 单一注册表派生（历史是 save/get 两张
 * 手工映射，新增键只改一侧会出现「保存成功但刷新丢失」）。这里守护：
 * 注册表键唯一、保存/读取都走注册表，且不再回潮为手工 configObj 名单。
 */
const source = readFileSync(
  resolve(process.cwd(), "src/store/modules/siteConfig.ts"),
  "utf-8"
);

describe("站点配置读写映射", () => {
  it("注册表内服务端键与本地键一一对应且不重复", () => {
    const serverKeys = PREFERENCE_FIELDS.map(field => field.serverKey);
    const localKeys = PREFERENCE_FIELDS.map(
      field => `${field.section}.${field.localKey}`
    );
    expect(new Set(serverKeys).size).toBe(serverKeys.length);
    expect(new Set(localKeys).size).toBe(localKeys.length);
    expect(serverKeys.length).toBeGreaterThan(90);
  });

  it("save/get 均从注册表派生，不再手写两张映射", () => {
    expect(source).toContain("serverPreferenceConfig({");
    expect(source).toContain("localPreferenceSections(");
    // 手工名单的典型特征：config.<PascalKey> ?? 缺省值
    expect(source).not.toMatch(/config\.[A-Z][A-Za-z0-9]*\s*\?\?/);
  });
});
