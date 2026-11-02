import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { drawerStore } from "@/components/ReDrawer";
import { createMenuDrawerSession } from "../menuDrawerSession";
import type { MenuAuths, MenuFormModel } from "../types";

const model = (title: string): MenuFormModel =>
  ({ title, menuType: 1, isActive: true }) as unknown as MenuFormModel;

const makeCore = () =>
  createMenuDrawerSession({
    t: ((key: string) => key) as never,
    auth: {} as MenuAuths,
    treeData: ref([]),
    choicesDict: ref({}),
    modelList: ref([]),
    viewList: ref({}),
    menuUrlList: ref([]),
    submit: vi.fn(async () => true)
  });

describe("菜单抽屉会话：切换节点不叠层", () => {
  beforeEach(() => {
    drawerStore.value = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    drawerStore.value = [];
  });

  it("首次打开入队一层并同步打开态", () => {
    const core = makeCore();
    core.open(model("编辑"), false, "编辑", 1);
    expect(drawerStore.value).toHaveLength(1);
    expect(drawerStore.value[0].title).toBe("编辑");
    expect(drawerStore.value[0].visible).toBe(true);
    expect(core.current.value?.pk).toBe(1);
  });

  it("打开态切换节点：复用同一实例，不叠加第二层", () => {
    const core = makeCore();
    core.open(model("甲"), false, "编辑甲", 1);
    core.open(model("乙"), false, "编辑乙", 2);

    expect(drawerStore.value).toHaveLength(1);
    expect(drawerStore.value[0].title).toBe("编辑乙");
    expect(core.current.value?.pk).toBe(2);
    // 新状态生成新的表单 key：表单按新模型重挂载（不会残留上一个节点）
    const vnode = drawerStore.value[0].contentRenderer?.({
      options: drawerStore.value[0],
      index: 0
    }) as { key?: unknown } | undefined;
    expect(vnode?.key).toBe("menu-form-2");
  });

  it("关闭后紧接打开：旧层仍在离场时新层延后入队，任一时刻只有一个可见层", async () => {
    const core = makeCore();
    core.open(model("甲"), false, "编辑甲", 1);
    core.close();
    expect(drawerStore.value[0].visible).toBe(false);

    core.open(model("乙"), false, "编辑乙", 2);
    // 旧层还在队列（离场动画中）：新层不立即入队
    expect(drawerStore.value).toHaveLength(1);
    expect(core.current.value?.pk).toBe(2);

    await vi.advanceTimersByTimeAsync(320);
    expect(drawerStore.value).toHaveLength(2);
    expect(drawerStore.value[1].visible).toBe(true);
    expect(drawerStore.value[1].title).toBe("编辑乙");
    expect(
      drawerStore.value.filter(item => item.visible === true)
    ).toHaveLength(1);
  });

  it("旧实例的关闭回调不清掉新实例的打开态", () => {
    const core = makeCore();
    core.open(model("甲"), false, "编辑甲", 1);
    const first = drawerStore.value[0];
    const firstClosed = first.closeCallBack;
    core.close();

    core.open(model("乙"), false, "编辑乙", 2);
    // 旧层 @closed 迟到：按清理令牌判定，不得清掉乙的打开态
    firstClosed?.({ options: first, index: 0, args: { command: "close" } });
    expect(core.isOpen()).toBe(true);
    expect(core.current.value?.pk).toBe(2);
  });
});
