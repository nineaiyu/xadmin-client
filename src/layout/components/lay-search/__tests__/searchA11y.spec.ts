import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { applyPaletteComboboxRole } from "../paletteA11y";

/**
 * 命令面板可访问性接线（静态守护，与 src/tests/static-guards.spec.ts 同范式）：
 * combobox（输入框）→ listbox（容器）→ option（各候选）三层语义与
 * aria-activedescendant 的同源 id 构造缺一不可——键盘 ↑↓/Enter 由全局监听模拟
 * 实现，语义层不接线时读屏用户不可感知（vue SFC 无 svg loader 不便在 jsdom
 * mount，故按仓内既有静态守护范式断言源码接线）。
 */
const DIR = path.resolve(process.cwd(), "src/layout/components/lay-search");
const read = (file: string) => fs.readFileSync(path.join(DIR, file), "utf8");

describe("命令面板 ARIA 接线", () => {
  it("SearchModal：输入框 combobox + 容器 listbox + activedescendant 指针", () => {
    const source = read("components/SearchModal.vue");
    // EP el-input 丢弃 role attr（useAttrs 排除表），combobox 角色经
    // applyPaletteComboboxRole 补写到原生 input——角色与 aria-* 必须同体，
    // 模板直接写 role 会静默消失（axe aria-allowed-attr，2026-11-04 实测）
    expect(source).not.toContain('role="combobox"');
    expect(source).toContain("applyPaletteComboboxRole(inputRef)");
    expect(source).toContain("aria-haspopup");
    expect(source).toContain(":aria-expanded");
    expect(source).toContain(":aria-controls");
    expect(source).toContain(":aria-activedescendant");
    expect(source).toContain('role="listbox"');
    // 指针与选项 id 同源构造（paletteOptionId 单一来源）
    expect(source).toContain("paletteOptionId(activeNav.value)");
    expect(source).toContain("PALETTE_LISTBOX_ID");
    // 角色补写实现必须在原生 input 上（paletteA11y 单一来源）
    const a11y = read("paletteA11y.ts");
    expect(a11y).toContain('setAttribute("role", "combobox")');
  });

  it("applyPaletteComboboxRole：把 role 写到 EP 实例暴露的原生 input 上", () => {
    const input = document.createElement("input");
    // EP InputInstance 形状：input = 原生元素；缺失时静默跳过
    applyPaletteComboboxRole({ input });
    expect(input.getAttribute("role")).toBe("combobox");
    applyPaletteComboboxRole(null);
    applyPaletteComboboxRole({ input: null });
    expect(input.getAttribute("role")).toBe("combobox");
  });

  it("SearchModal：快捷动作/全局搜索/问 AI 候选均为 option 且带 id", () => {
    const source = read("components/SearchModal.vue");
    const optionCount = (source.match(/role="option"/g) ?? []).length;
    expect(optionCount).toBeGreaterThanOrEqual(3);
    expect(source).toContain(`:aria-selected="commandActive === item.id"`);
    expect(source).toContain("paletteOptionId('ask:ai')");
  });

  it("SearchResult / SearchHistory：菜单与历史候选均为 option 且 id 与指针同源", () => {
    for (const file of [
      "components/SearchResult.vue",
      "components/SearchHistory.vue"
    ]) {
      const source = read(file);
      expect(source, file).toContain("paletteOptionId");
      expect(source, file).toContain('role="option"');
      expect(source, file).toContain(':aria-selected="item.path === active"');
    }
  });

  it("选中态不得写死字号跳变与白字（字号恒定 + 对比度自适应）", () => {
    for (const file of [
      "components/SearchResult.vue",
      "components/SearchHistory.vue"
    ]) {
      const source = read(file);
      expect(source, file).not.toMatch(/fontSize[^}]*16px/);
      expect(source, file).toContain("pickSelectedForeground");
      expect(source, file).not.toMatch(/transition:\s*font-size/);
    }
  });
});
