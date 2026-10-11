import { flushPromises, mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { ElButton, ElDialog, ElPopconfirm } from "element-plus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { h, nextTick } from "vue";

import {
  addDialog,
  closeAllDialog,
  closeDialog,
  dialogStore,
  getDialogUid,
  updateDialog,
  ReDialog
} from "../index";
import { DIALOG_SIZES, dialogSize } from "../size";

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
  mount(ReDialog as never, {
    global: {
      plugins: [i18n],
      components: { ElDialog, ElButton, ElPopconfirm }
    },
    attachTo: document.body
  });

const footerButtons = () =>
  Array.from(document.querySelectorAll(".el-dialog__footer button"));

describe("ReDialog 弹层容器", () => {
  beforeEach(() => {
    dialogStore.value = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    closeAllDialog();
    document.body.innerHTML = "";
  });

  it("addDialog：入 store 且 visible=true，_uid 不可枚举（不随 v-bind 透传）", () => {
    const options = { title: "标题" };
    addDialog(options);
    expect(dialogStore.value).toHaveLength(1);
    expect(dialogStore.value[0].visible).toBe(true);
    expect(getDialogUid(dialogStore.value[0])).toBeGreaterThan(0);
    expect(Object.keys(options)).not.toContain("_uid");
  });

  it("多个弹层各自拿到自增 uid（下标漂移时的状态键）", () => {
    const first = { title: "一" };
    const second = { title: "二" };
    addDialog(first);
    addDialog(second);
    expect(getDialogUid(second)! - getDialogUid(first)!).toBe(1);
  });

  it("updateDialog 按索引改属性", () => {
    addDialog({ title: "旧" });
    updateDialog("新", "title", 0);
    expect(dialogStore.value[0].title).toBe("新");
  });

  it("closeDialog：置 visible=false 并回调 closeCallBack，延迟后移出 store", async () => {
    const closeCallBack = vi.fn();
    const options = { title: "标题", closeCallBack };
    addDialog(options);
    closeDialog(dialogStore.value[0], 0, { command: "cancel" });
    expect(dialogStore.value[0].visible).toBe(false);
    expect(closeCallBack).toHaveBeenCalledWith(
      expect.objectContaining({ args: { command: "cancel" } })
    );
    expect(dialogStore.value).toHaveLength(1);

    vi.advanceTimersByTime(200);
    await nextTick();
    expect(dialogStore.value).toHaveLength(0);
  });

  it("容器：默认页脚为「取消 / 保存」，保存走 beforeSure(done) 后可关闭", async () => {
    const beforeSure = vi.fn((done: () => void) => done());
    mountContainer();
    addDialog({
      title: "编辑",
      contentRenderer: () => h("div", { class: "spec-body" }, "正文"),
      beforeSure
    });
    await nextTick();
    await flushPromises();

    const labels = footerButtons().map(button => button.textContent?.trim());
    expect(labels).toEqual(["取消", "保存"]);

    const save = footerButtons().find(
      button => button.textContent?.trim() === "保存"
    );
    (save as HTMLElement | undefined)?.click();
    await nextTick();
    expect(beforeSure).toHaveBeenCalledTimes(1);
    // done() 已执行：visible 落 false，延迟后出栈由假定时器推进
    expect(dialogStore.value[0]?.visible).toBe(false);
  });

  it("容器：自定义 footerButtons 覆盖默认页脚；hideFooter 时不渲染页脚", async () => {
    const custom = vi.fn();
    mountContainer();
    addDialog({
      title: "自定义",
      contentRenderer: () => h("div", "正文"),
      footerButtons: [
        {
          label: "只留我",
          btnClick: () => custom()
        }
      ]
    });
    await nextTick();
    await flushPromises();
    expect(footerButtons().map(button => button.textContent?.trim())).toEqual([
      "只留我"
    ]);
    (footerButtons()[0] as HTMLElement | undefined)?.click();
    await nextTick();
    expect(custom).toHaveBeenCalledTimes(1);

    closeAllDialog();
    await nextTick();
    addDialog({
      title: "无页脚",
      hideFooter: true,
      contentRenderer: () => h("div", "正文")
    });
    await nextTick();
    await flushPromises();
    expect(document.querySelector(".el-dialog__footer")).toBeNull();
  });
});

describe("ReDialog 尺寸档位", () => {
  it("语义档位映射为 px 宽度字符串", () => {
    expect(dialogSize("sm")).toBe("480px");
    expect(dialogSize("md")).toBe("640px");
    expect(dialogSize("lg")).toBe("760px");
    expect(dialogSize("xl")).toBe("860px");
    expect(Object.keys(DIALOG_SIZES)).toEqual(["sm", "md", "lg", "xl"]);
  });
});
