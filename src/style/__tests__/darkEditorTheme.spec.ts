import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 暗色编辑器不走 filter invert（会把图片/视频反相并产生整块合成层），
 * 而是映射 WangEditor 的 --w-e-* 主题变量到 EP 暗色令牌。
 */
const css = readFileSync(
  resolve(process.cwd(), "src/style/dark.scss"),
  "utf-8"
);

describe("暗色编辑器主题", () => {
  it("WangEditor 使用 --w-e-* 令牌，不对整块编辑器做 invert", () => {
    expect(css).not.toMatch(/\.wangeditor\s*\{[^}]*filter:\s*invert/);
    expect(css).toContain("--w-e-textarea-bg-color");
    expect(css).toContain("--w-e-toolbar-bg-color");
  });

  it("已无消费方的 logic-flow-view 选择器不再保留", () => {
    expect(css).not.toMatch(/\.logic-flow-view\s*[,{]/);
  });
});
