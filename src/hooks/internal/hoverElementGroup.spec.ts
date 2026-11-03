import { describe, expect, it } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { createHoverElementGroup } from "./hoverElementGroup";

describe("createHoverElementGroup", () => {
  it("悬停监听作用域与创建时的活动作用域解耦（detached）", async () => {
    const el = document.createElement("div");
    const rootRef = ref<HTMLElement | null>(el);
    const ambient = effectScope();
    let group: ReturnType<typeof createHoverElementGroup> | undefined;
    // 模拟真实挂载期：rebuild 恰好在无关组件的作用域活跃时执行。
    // 历史缺陷：作用域未声明 detached，侧栏菜单文字组件（ReText）卸载时
    // 会级联停掉悬停监听——折叠侧栏后「折叠态悬停展开」永久失效。
    ambient.run(() => {
      group = createHoverElementGroup(rootRef);
    });
    expect(group!.hovers.value.length).toBe(1);

    // 无关作用域停止：悬停监听不得被级联销毁
    ambient.stop();
    el.dispatchEvent(new Event("mouseenter"));
    await nextTick();
    expect(group!.hovers.value[0].value).toBe(true);

    el.dispatchEvent(new Event("mouseleave"));
    await nextTick();
    expect(group!.hovers.value[0].value).toBe(false);
  });

  it("dispose 清理后悬停不再响应", async () => {
    const el = document.createElement("div");
    const rootRef = ref<HTMLElement | null>(el);
    const group = createHoverElementGroup(rootRef);
    expect(group.hovers.value.length).toBe(1);

    group.dispose();
    el.dispatchEvent(new Event("mouseenter"));
    await nextTick();
    expect(group.hovers.value[0].value).toBe(false);
  });
});
