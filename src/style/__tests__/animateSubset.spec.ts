import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * animate.css 按需子集守护：
 * 生成物（src/style/animate-subset.css，构建期由 scripts/gen-animate-subset.mjs 产出）
 * 的引入面必须与 ReAnimateSelector 的 animates 清单（页面级自定义过渡的可选值域）
 * 逐项一致——任何一侧增减而未同步，都会表现为「类存在但无关键帧」的静默失效，
 * 或「多余动画」的体积回潮。
 */
describe("animate.css 按需子集", () => {
  const read = (path: string) =>
    readFileSync(resolve(process.cwd(), path), "utf-8");
  const subsetPath = resolve(process.cwd(), "src/style/animate-subset.css");

  const animateTs = read(
    "src/views/system/menu/components/ReAnimateSelector/src/animate.ts"
  );
  /** 选择器可选动画清单（animates 数组的字符串字面量） */
  const listNames = [...animateTs.matchAll(/"([A-Za-z0-9]+)"/g)].map(m => m[1]);

  /** 子集内的 animate__ 类名（排除 animated / infinite 两个修饰类） */
  const subsetCss = existsSync(subsetPath)
    ? readFileSync(subsetPath, "utf-8")
    : "";
  const modifierClasses = new Set(["animated", "infinite"]);
  const subsetClasses = new Set(
    [...subsetCss.matchAll(/\.animate__([A-Za-z0-9]+)/g)]
      .map(m => m[1])
      .filter(name => !modifierClasses.has(name))
  );
  const subsetKeyframes = new Set(
    [...subsetCss.matchAll(/@(?:-webkit-)?keyframes\s+([A-Za-z0-9]+)/g)].map(
      m => m[1]
    )
  );

  it("子集已生成（缺失时先运行 node scripts/gen-animate-subset.mjs）", () => {
    expect(existsSync(subsetPath), "缺少 src/style/animate-subset.css").toBe(
      true
    );
  });

  it("清单中每个动画都有关键帧与类规则", () => {
    const missingFrames = listNames.filter(name => !subsetKeyframes.has(name));
    const missingClasses = listNames.filter(name => !subsetClasses.has(name));
    expect(missingFrames, `缺少关键帧：${missingFrames.join(", ")}`).toEqual(
      []
    );
    expect(missingClasses, `缺少类规则：${missingClasses.join(", ")}`).toEqual(
      []
    );
  });

  it("子集不含清单之外的动画（防全量回退）", () => {
    const extraFrames = [...subsetKeyframes].filter(
      name => !listNames.includes(name)
    );
    const extraClasses = [...subsetClasses].filter(
      name => !listNames.includes(name)
    );
    expect(extraFrames, `多余关键帧：${extraFrames.join(", ")}`).toEqual([]);
    expect(extraClasses, `多余类规则：${extraClasses.join(", ")}`).toEqual([]);
  });

  it("基础类就位（animated / infinite / flip 联合选择器）", () => {
    expect(subsetCss).toContain(".animate__animated {");
    expect(subsetCss).toContain(".animate__animated.animate__infinite {");
    if (listNames.includes("flip")) {
      expect(subsetCss).toContain(".animate__animated.animate__flip {");
    }
  });

  it("未使用修饰符已剔除（repeat / delay / slow / faster）", () => {
    for (const modifier of ["repeat-1", "delay-1s", "slow", "faster"]) {
      expect(
        subsetCss.includes(`.animate__animated.animate__${modifier}`),
        `修饰符 animate__${modifier} 不应出现在子集`
      ).toBe(false);
    }
  });

  it("布局入口引入子集而非全量 animate.css（防回退）", () => {
    const layoutEntry = read("src/layout/index.vue");
    expect(layoutEntry).toContain('import "@/style/animate-subset.css"');
    expect(layoutEntry).not.toContain('import "animate.css"');
  });
});
