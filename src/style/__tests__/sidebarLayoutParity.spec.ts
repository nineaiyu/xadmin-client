import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../sidebar/${name}`, import.meta.url)),
    "utf-8"
  );

describe("侧栏布局能力对等（悬停展开 / 折叠显示标题）", () => {
  const animatedLayouts = [
    "_vertical.scss",
    "_mix.scss",
    "_header-sidebar-nav.scss",
    "_sidebar-mixed-nav.scss"
  ];

  it.each(animatedLayouts)("%s 接入悬停展开 mixin", file => {
    expect(read(file)).toContain("@include sidebar-hover-expand");
  });

  it.each([...animatedLayouts, "_header-mixed-nav.scss"])(
    "%s 接入折叠显示标题 mixin",
    file => {
      expect(read(file)).toContain("@include sidebar-collapse-show-title");
    }
  );
});
