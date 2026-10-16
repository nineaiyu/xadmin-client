import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EP 语义色阶派生守护（tokens/ep-bridge.scss 的 @supports color-mix 段）。
 *
 * 色阶不是静态值，而是按「色阶名 → 令牌名前缀」映射现场派生。映射里的令牌一旦
 * 不存在（历史现场：ep-bridge 按色阶名取 `var(--error)`，而令牌层只有 --danger），
 * 整条 color-mix 即「计算期无效」——不仅该档缺失，还会覆盖 EP 自带同名词条，
 * 使 el-message / el-alert 等 error 形态退化为透明底 + currentColor 描边
 * （表现为提示条黑框、无底色）。本守护把「映射引用的令牌真实存在」固化为断言。
 *
 * 守护四点：①映射清单逐项固定（防误删色阶名）；②引用的令牌在 tokens 层有定义；
 * ③派生表达式使用映射出的令牌（而非色阶名自身）；④派生块产出 light 1..9 与 dark-2。
 */
describe("EP 语义色阶派生（ep-bridge）", () => {
  const read = (path: string) =>
    readFileSync(resolve(process.cwd(), path), "utf-8");

  const bridge = read("src/style/tokens/ep-bridge.scss");
  const tokenSources = ["primitives", "semantic", "presets"]
    .map(fileName => read(`src/style/tokens/${fileName}.scss`))
    .join("\n");

  /** 定位 `$derived-colors: (...)` 映射块并解析条目 */
  const mapStart = bridge.indexOf("$derived-colors: (");
  const mapEnd = bridge.indexOf(");", mapStart);
  const mapBlock =
    mapStart === -1 ? "" : bridge.slice(mapStart, mapEnd === -1 ? -1 : mapEnd);
  const entries = [...mapBlock.matchAll(/"([a-z-]+)":\s*"([a-z-]+)"/g)].map(
    match => ({ name: match[1], token: `--${match[2]}` })
  );

  it("色阶映射块可解析且覆盖全部语义色（含 EP 同源的 error）", () => {
    expect(mapStart, "缺少 $derived-colors 映射块").toBeGreaterThan(-1);
    expect(entries.map(item => `${item.name}=${item.token}`).sort()).toEqual(
      [
        "danger=--danger",
        "error=--danger",
        "primary=--primary",
        "success=--success",
        "warning=--warning"
      ].sort()
    );
  });

  it("每个色阶名引用的令牌都在 tokens 层真实定义", () => {
    for (const { name, token } of entries) {
      const pattern = new RegExp(
        `${token.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\s*:`
      );
      expect(
        pattern.test(tokenSources),
        `色阶 ${name} 引用的 ${token} 未在 tokens 层定义（派生将整族失效）`
      ).toBe(true);
    }
  });

  it("派生表达式使用映射出的令牌，而非色阶名自身", () => {
    expect(bridge).toContain("hsl(var(--#{$token}))");
    expect(
      bridge.includes("hsl(var(--#{$name}))"),
      "色阶派生不得直接按色阶名取令牌（error 等别名会取到空值）"
    ).toBe(false);
  });

  it("派生块同时产出 light 1..9 与 dark-2", () => {
    expect(bridge).toContain("--el-color-#{$name}-light-#{$i}");
    expect(bridge).toContain("--el-color-#{$name}-dark-2");
    expect(bridge).toContain("@for $i from 1 through 9");
  });
});
