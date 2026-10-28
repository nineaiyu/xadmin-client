import { flushPromises, mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { ElButton, ElDrawer, ElPopconfirm } from "element-plus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, nextTick } from "vue";

import {
  addDrawer,
  closeAllDrawer,
  closeDrawer,
  drawerStore,
  getDrawerUid,
  updateDrawer,
  ReDrawer
} from "../index";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      buttons: { cancel: "取消", save: "保存" },
      layout: { more: "更多" }
    }
  }
});

const mountContainer = () =>
  mount(ReDrawer as never, {
    global: {
      plugins: [i18n],
      components: { ElDrawer, ElButton, ElPopconfirm }
    },
    attachTo: document.body
  });

describe("ReDrawer 抽屉容器", () => {
  beforeEach(() => {
    drawerStore.value = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    closeAllDrawer();
    document.body.innerHTML = "";
  });

  it("addDrawer：入 store 且 visible=true，_uid 不可枚举", () => {
    const options = { title: "抽屉" };
    addDrawer(options);
    expect(drawerStore.value).toHaveLength(1);
    expect(drawerStore.value[0].visible).toBe(true);
    expect(getDrawerUid(drawerStore.value[0])).toBeGreaterThan(0);
    expect(Object.keys(options)).not.toContain("_uid");
  });

  it("updateDrawer 改属性；closeDrawer 回调并延迟出栈", async () => {
    const closeCallBack = vi.fn();
    addDrawer({ title: "旧", size: 400, closeCallBack });
    updateDrawer(560, "size", 0);
    expect(drawerStore.value[0].size).toBe(560);

    closeDrawer(drawerStore.value[0], 0, { command: "close" });
    expect(drawerStore.value[0].visible).toBe(false);
    expect(closeCallBack).toHaveBeenCalledWith(
      expect.objectContaining({ args: { command: "close" } })
    );
    vi.advanceTimersByTime(200);
    await nextTick();
    expect(drawerStore.value).toHaveLength(0);
  });

  it("容器：默认页脚「取消 / 保存」，保存经 beforeSure(done) 收尾", async () => {
    const beforeSure = vi.fn((done: () => void) => done());
    mountContainer();
    addDrawer({
      title: "编辑",
      contentRenderer: () => h("div", { class: "spec-body" }, "正文"),
      beforeSure
    });
    await nextTick();
    await flushPromises();

    const buttons = Array.from(
      document.querySelectorAll(".el-drawer__footer button")
    );
    expect(buttons.map(button => button.textContent?.trim())).toEqual([
      "取消",
      "保存"
    ]);
    (
      buttons.find(button => button.textContent?.trim() === "保存") as
        HTMLElement | undefined
    )?.click();
    await nextTick();
    expect(beforeSure).toHaveBeenCalledTimes(1);
    expect(drawerStore.value[0]?.visible).toBe(false);
  });

  it("beforeClose：取消按钮先走守卫，done 后才真正关闭", async () => {
    const beforeClose = vi.fn((_done: () => void) => undefined);
    mountContainer();
    addDrawer({
      title: "编辑",
      contentRenderer: () => h("div", "正文"),
      beforeClose
    });
    await nextTick();
    await flushPromises();

    const cancel = Array.from(
      document.querySelectorAll(".el-drawer__footer button")
    ).find(button => button.textContent?.trim() === "取消");
    (cancel as HTMLElement | undefined)?.click();
    await nextTick();

    expect(beforeClose).toHaveBeenCalledTimes(1);
    expect(drawerStore.value[0]?.visible).toBe(true);

    beforeClose.mock.calls[0]![0]();
    await nextTick();
    expect(drawerStore.value[0]?.visible).toBe(false);
  });

  it("内容组件 emit('close') 同样走 beforeClose；done(true) 取消关闭", async () => {
    const beforeClose = vi.fn((done: (cancel?: boolean) => void) => done(true));
    const Content = {
      name: "DrawerContent",
      emits: ["close"],
      template:
        "<button class='spec-close' @click=\"$emit('close', { command: 'close' })\">关</button>"
    };
    mountContainer();
    addDrawer({
      title: "编辑",
      contentRenderer: () => h(Content),
      beforeClose
    });
    await nextTick();
    await flushPromises();

    (document.querySelector(".spec-close") as HTMLElement).click();
    await nextTick();
    expect(beforeClose).toHaveBeenCalledTimes(1);
    // done(true) = 取消关闭：抽屉保持打开
    expect(drawerStore.value[0]?.visible).toBe(true);

    beforeClose.mock.calls[0]![0](false);
    await nextTick();
    expect(drawerStore.value[0]?.visible).toBe(false);
  });

  it("收起的抽屉若内容已销毁则不报错（destroyOnClose 关闭态直接出栈）", async () => {
    mountContainer();
    addDrawer({
      title: "临时",
      destroyOnClose: true,
      contentRenderer: () => h("div", "x")
    });
    await nextTick();
    await flushPromises();
    closeDrawer(drawerStore.value[0], 0);
    await nextTick();
    expect(drawerStore.value[0]?.visible).toBe(false);
  });
});

describe("ReDrawer 焦点圈入（弹层打开后键盘焦点入层、关闭后还原触发元素）", () => {
  beforeEach(() => {
    drawerStore.value = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    closeAllDrawer();
    document.body.innerHTML = "";
  });

  it("打开后初始焦点落在抽屉内，关闭后焦点还原到触发元素", async () => {
    mountContainer();
    const trigger = document.createElement("button");
    trigger.textContent = "触发按钮";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    addDrawer({
      title: "焦点实证",
      contentRenderer: () => h("div", [h("input", { class: "probe-input" })])
    });
    await flushPromises();
    await nextTick();

    const drawer = document.querySelector(".el-drawer");
    expect(drawer).toBeTruthy();
    expect(
      drawer!.contains(document.activeElement),
      `初始焦点应落在抽屉内，实际为 ${document.activeElement?.outerHTML ?? "null"}`
    ).toBe(true);

    closeDrawer(drawerStore.value[0], 0);
    await flushPromises();
    vi.advanceTimersByTime(300); // closeDelay 默认 200ms，过后抽屉出栈
    await flushPromises();
    expect(
      document.activeElement,
      "关闭后焦点应还原到触发元素（EP focus-trap 的 return-focus）"
    ).toBe(trigger);
  });
});
