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
import {
  DIALOG_SIZES,
  DRAWER_NARROW_WIDTH,
  DRAWER_SIZES,
  dialogSize,
  drawerSize
} from "../size";

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

  it("多弹层并存：全屏状态按弹层隔离，互不串扰且可独立退出", async () => {
    mountContainer();
    addDialog({
      title: "甲",
      fullscreenIcon: true,
      contentRenderer: () => h("div", "甲")
    });
    addDialog({
      title: "乙",
      fullscreenIcon: true,
      contentRenderer: () => h("div", "乙")
    });
    await nextTick();
    await flushPromises();

    const dialogs = () => Array.from(document.querySelectorAll(".el-dialog"));
    const fullscreenIcons = () =>
      Array.from(
        document.querySelectorAll('[data-testid="dialog-fullscreen-toggle"]')
      );

    // 只点甲的全屏按钮：仅甲进入全屏（历史缺陷：共享 ref 会让乙同步全屏）
    (fullscreenIcons()[0] as HTMLElement).click();
    await nextTick();
    expect(dialogs()[0].classList.contains("is-fullscreen")).toBe(true);
    expect(dialogs()[1].classList.contains("is-fullscreen")).toBe(false);

    // 乙也全屏：两者各自独立持有状态
    (fullscreenIcons()[1] as HTMLElement).click();
    await nextTick();
    expect(dialogs()[0].classList.contains("is-fullscreen")).toBe(true);
    expect(dialogs()[1].classList.contains("is-fullscreen")).toBe(true);

    // 再点甲退出：乙不受影响（历史缺陷：乙的 open 事件会重置共享标志把甲带出全屏）
    (fullscreenIcons()[0] as HTMLElement).click();
    await nextTick();
    expect(dialogs()[0].classList.contains("is-fullscreen")).toBe(false);
    expect(dialogs()[1].classList.contains("is-fullscreen")).toBe(true);
  });

  it("全屏按钮默认渲染：未传 fullscreenIcon 也有切换按钮，点击后进入全屏", async () => {
    mountContainer();
    addDialog({
      title: "岗位",
      contentRenderer: () => h("div", "正文")
    });
    await nextTick();
    await flushPromises();

    const icons = () =>
      Array.from(
        document.querySelectorAll('[data-testid="dialog-fullscreen-toggle"]')
      );
    expect(icons()).toHaveLength(1);

    (icons()[0] as HTMLElement).click();
    await nextTick();
    expect(
      document.querySelector(".el-dialog")?.classList.contains("is-fullscreen")
    ).toBe(true);

    // 再点退出：可逆，不是单向开关
    (icons()[0] as HTMLElement).click();
    await nextTick();
    expect(
      document.querySelector(".el-dialog")?.classList.contains("is-fullscreen")
    ).toBe(false);
  });

  it("全屏按钮显式关闭：fullscreenIcon=false 时走 EP 默认头部", async () => {
    mountContainer();
    addDialog({
      title: "无按钮",
      fullscreenIcon: false,
      contentRenderer: () => h("div", "正文")
    });
    await nextTick();
    await flushPromises();

    expect(
      document.querySelectorAll('[data-testid="dialog-fullscreen-toggle"]')
    ).toHaveLength(0);
    // EP 默认头部仍渲染标题与关闭按钮（结构完整性不回退）
    expect(document.querySelector(".el-dialog__title")?.textContent).toBe(
      "无按钮"
    );
    expect(document.querySelector(".el-dialog__headerbtn")).not.toBeNull();
  });

  it("自定义 headerRenderer 优先：按钮不插入自绘头部", async () => {
    mountContainer();
    addDialog({
      title: "自定义",
      headerRenderer: ({ close: _close }) =>
        h("div", { class: "spec-custom-header" }, "自绘头部"),
      contentRenderer: () => h("div", "正文")
    });
    await nextTick();
    await flushPromises();

    expect(
      document.querySelectorAll('[data-testid="dialog-fullscreen-toggle"]')
    ).toHaveLength(0);
    expect(document.querySelector(".spec-custom-header")).not.toBeNull();
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
    expect(dialogSize("xxl")).toBe("960px");
    expect(Object.keys(DIALOG_SIZES)).toEqual(["sm", "md", "lg", "xl", "xxl"]);
  });

  it("抽屉档位映射为视口比例字符串，并提供固定窄档", () => {
    expect(drawerSize("sm")).toBe("40%");
    expect(drawerSize("md")).toBe("50%");
    expect(drawerSize("lg")).toBe("60%");
    expect(drawerSize("xl")).toBe("75%");
    expect(drawerSize("full")).toBe("100%");
    expect(Object.keys(DRAWER_SIZES)).toEqual(["sm", "md", "lg", "xl", "full"]);
    expect(DRAWER_NARROW_WIDTH).toBe("480px");
  });
});
