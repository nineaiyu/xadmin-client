import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 用户 / 文件 / 账号风险页的勾选列守卫（静态解析，不挂载整页）。
 *
 * 三页都有批量动作但此前走 RePlusPage 默认勾选：只读角色会看到「能选但无动作」
 * 的死交互。勾选条件必须与各自的批量动作权限保持一致。
 */
const PAGE_DIR = resolve(__dirname, "../..");

const readPage = (path: string) => readFileSync(join(PAGE_DIR, path), "utf-8");

describe("列表页勾选列与批量动作权限一致", () => {
  it("用户页：批删 / 批量更新 / 批量通知 / 批量打标任一授权才显示勾选", () => {
    const source = readPage("user/index.vue");
    expect(source).toMatch(/hasBatchSelection\(auth, \[/);
    expect(source).toContain('"batchUpdate:SystemUser"');
    expect(source).toContain('"create:SystemNotice"');
    expect(source).toContain('"assign:Tag"');
  });

  it("文件页：批量打标或批删任一授权才显示勾选", () => {
    const source = readPage("file/index.vue");
    expect(source).toMatch(
      /:selection="hasBatchSelection\(auth, \['assign:Tag'\]\)"/
    );
  });

  it("账号风险页：仅持批量处置权限时显示勾选", () => {
    const source = readPage("account-risk/index.vue");
    expect(source).toContain(':selection="Boolean(auth.batchHandle)"');
  });

  it("任务执行历史：批删权限决定勾选列（批量删除入口依赖勾选）", () => {
    const source = readPage("celery/logs/index.vue");
    expect(source).toContain(':selection="Boolean(auth.batchDestroy)"');
  });
});
