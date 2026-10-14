import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { capturePlatformDefaults } from "@/utils/preferences";
import {
  SITE_WIDE_APPEARANCE_FIELDS,
  buildSiteWideAppearanceDefaults
} from "../siteWideAppearance";

/**
 * 站点级外观默认值守卫（「恢复站点默认」的取值来源）：
 * 1. `SITE_WIDE_APPEARANCE_FIELDS` 的 `config` 键必须与后端
 *    `ConfigsViewSet.SITE_WIDE_CONFIG_KEYS` 一一对应（单仓检出时跳过该点）；
 * 2. 默认值必须来自 `public/platform-config.json` 的出厂值（而不是运行时被服务端
 *    站点配置合并后的 `getConfig()`）——部署方替换该文件即改默认值。
 */

const ROOT = resolve(__dirname, "../../../..");
const PLATFORM_CONFIG = resolve(ROOT, "public/platform-config.json");
const SERVER_VIEWS = resolve(
  ROOT,
  "../xadmin-server/system/views/user/configs.py"
);

const platformConfig = JSON.parse(
  readFileSync(PLATFORM_CONFIG, "utf-8")
) as Record<string, unknown>;

const hoisted = vi.hoisted(() => ({ config: {} as Record<string, unknown> }));

vi.mock("@/config", () => ({
  getConfig: () => hoisted.config,
  responsiveStorageNameSpace: () => "responsive-"
}));

beforeEach(() => {
  hoisted.config = JSON.parse(JSON.stringify(platformConfig));
  capturePlatformDefaults();
});

describe("站点级外观默认值", () => {
  it("默认值取自 platform-config.json 的出厂值", () => {
    const defaults = buildSiteWideAppearanceDefaults();
    expect(defaults).toEqual(
      Object.fromEntries(
        SITE_WIDE_APPEARANCE_FIELDS.map(field => [
          field.storage,
          platformConfig[field.config]
        ])
      )
    );
    // 每个键都应取到值（平台配置缺键会被跳过，属配置漂移）
    expect(Object.keys(defaults)).toHaveLength(
      SITE_WIDE_APPEARANCE_FIELDS.length
    );
  });

  it("运行时站点配置合并后仍返回出厂值（不受 getConfig 现值影响）", () => {
    hoisted.config.Title = "被站点配置改过的标题";
    expect(buildSiteWideAppearanceDefaults().title).toBe(platformConfig.Title);
  });

  it("平台配置缺键时跳过该键（不写入 undefined）", () => {
    delete hoisted.config.LogoSource;
    capturePlatformDefaults();
    const defaults = buildSiteWideAppearanceDefaults();
    expect("logoSource" in defaults).toBe(false);
    expect(defaults.title).toBe(platformConfig.Title);
  });

  it("字段清单与后端 SITE_WIDE_CONFIG_KEYS 一一对应", () => {
    if (!existsSync(SERVER_VIEWS)) return; // 单仓检出：无后端源码时跳过
    const source = readFileSync(SERVER_VIEWS, "utf-8");
    const block =
      /SITE_WIDE_CONFIG_KEYS\s*=\s*frozenset\(\s*\{([\s\S]*?)\}\s*\)/.exec(
        source
      )?.[1] ?? "";
    const backendKeys = Array.from(block.matchAll(/"(\w+)"/g))
      .map(match => match[1])
      .sort();
    expect(backendKeys).not.toHaveLength(0);
    expect(
      SITE_WIDE_APPEARANCE_FIELDS.map(field => field.config).sort()
    ).toEqual(backendKeys);
  });
});
