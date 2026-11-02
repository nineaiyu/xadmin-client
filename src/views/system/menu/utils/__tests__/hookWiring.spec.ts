import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 接线顺序守护：useMenuReveal 先于 useMenuInteractions 创建，滚动回调必须是
 * 晚绑定（先声明可变入口、交互域创建后再赋值），不得直接闭包引用后声明的
 * const interactions——后者虽在用户动作前不触发，但重构时极易踩 TDZ。
 */
const source = readFileSync(
  resolve(process.cwd(), "src/views/system/menu/utils/hook.tsx"),
  "utf-8"
);

describe("useMenu 接线顺序", () => {
  it("reveal 先创建，交互域随后创建", () => {
    expect(source.indexOf("useMenuReveal(")).toBeLessThan(
      source.indexOf("useMenuInteractions(")
    );
  });

  it("滚动定位走晚绑定入口，不在 reveal 参数里引用 interactions", () => {
    const revealBlock = source.slice(
      source.indexOf("const reveal = useMenuReveal("),
      source.indexOf("const drawer = useMenuDrawer(")
    );
    expect(revealBlock).toContain("scrollToTreePk?.(pk)");
    expect(revealBlock).not.toContain("interactions.");

    const assignAt = source.indexOf("scrollToTreePk = pk =>");
    const interactionsAt = source.indexOf(
      "const interactions = useMenuInteractions("
    );
    expect(assignAt).toBeGreaterThan(interactionsAt);
  });
});
