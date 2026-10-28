import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 数据权限页（模型字段）表格配置守卫（静态解析，不挂载组件）。
 *
 * 该页只读：没有批量操作，也没有行内多选语义。表格默认带勾选列时，
 * 勾上任何行都不会出现批量按钮——用户看到的是「能选但选了没用」的死交互。
 * `:selection="false"` 是这条语义的唯一落点（RePlusPage 的默认值是开），
 * 一旦被复制粘贴/重构抹掉，模板照样能编译、类型也不报错，只有肉眼看页面才发现。
 */

const PAGE_FILE = join(resolve(__dirname, ".."), "index.vue");

describe("数据权限页表格选择列", () => {
  const source = readFileSync(PAGE_FILE, "utf-8");

  it("显式关闭表格勾选列", () => {
    expect(source).toMatch(/:selection="false"/);
  });
});
