import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 菜单外全屏页声明机制守护（源码层断言）：
 *
 * 模块自带的全屏页在 `views/<模块>/routes.ts` 内声明，由框架路由表 glob 装配；
 * 一旦回退到「逐页登记进 remaining.ts」，本用例即失败（新增页面又得改框架文件）。
 */
const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

describe("菜单外全屏页声明", () => {
  it("模块自带声明文件（大屏 / 报表）", () => {
    const screen = read("../../views/analysis/screen/routes.ts");
    expect(screen).toContain('"/analysis/screen/display"');
    expect(screen).toContain('"/analysis/screen/designer"');
    expect(screen.match(/showLink: false/g)?.length).toBe(2);

    const report = read("../../views/analysis/report/routes.ts");
    expect(report).toContain('"/analysis/report/designer"');
    expect(report).toContain("showLink: false");
  });

  it("框架路由表只自动装配模块声明，不再逐页登记", () => {
    const remaining = read("../modules/remaining.ts");
    expect(remaining).toContain("import.meta.glob");
    expect(remaining).toContain("/src/views/**/routes.ts");
    expect(remaining).not.toContain("/analysis/screen/display");
    expect(remaining).not.toContain("/analysis/screen/designer");
    expect(remaining).not.toContain("/analysis/report/designer");
  });
});
