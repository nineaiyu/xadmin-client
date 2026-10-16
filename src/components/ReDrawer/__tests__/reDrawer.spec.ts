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
