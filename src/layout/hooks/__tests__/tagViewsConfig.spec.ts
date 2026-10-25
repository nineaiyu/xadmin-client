import { beforeEach, describe, expect, it } from "vitest";
import { storageLocal } from "@pureadmin/utils";

import { setConfig } from "@/config";
import { createTagsPreferences } from "../tagViewsConfig";

/**
 * 页签偏好读取测试：configure 键缺失 / 字段缺失 / 有值三态。
 * 回归背景：旧实现的 `.hideTabs` 在 configure 整键缺失时空引用，
 * 且 `ref(x) ?? ref("false")` 的兜底因 ref 对象恒真而永不生效。
 */

setConfig({ ResponsiveStorageNameSpace: "spec-" });
const KEY = "spec-configure";

describe("createTagsPreferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("configure 键缺失时不抛错，回落默认值（chrome + 显示页签）", () => {
    const { tagsStyle, hideTags } = createTagsPreferences();
    expect(tagsStyle.value).toBe("chrome");
    expect(hideTags.value).toBe(false);
  });

  it("字段缺失时空值兜底生效（tagsStyle 空串回落 chrome）", () => {
    storageLocal().setItem(KEY, { grey: false });
    const { tagsStyle, hideTags } = createTagsPreferences();
    expect(tagsStyle.value).toBe("chrome");
    expect(hideTags.value).toBe(false);
  });

  it("已存偏好原样透传（card 风格 + 隐藏页签）", () => {
    storageLocal().setItem(KEY, { tagsStyle: "card", hideTabs: true });
    const { tagsStyle, hideTags } = createTagsPreferences();
    expect(tagsStyle.value).toBe("card");
    expect(hideTags.value).toBe(true);
  });
});
