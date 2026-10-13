import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { ElButton, ElDialog, ElPopconfirm } from "element-plus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";

import { addDialog, closeAllDialog, dialogStore, ReDialog } from "../index";
import type { DialogOptions } from "../type";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": { buttons: { cancel: "取消", save: "保存" } }
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

type Draft = { name: string; member_pks: number[] };
const emptyDraft = (): Draft => ({ name: "", member_pks: [] });

/**
 * 载荷通道（类型化跨组件数据）：
 * 与 ReDrawer 的对应 spec 同构——两套弹层体系各自自足实现，同构由用例对齐。
 */
describe("ReDialog 类型化载荷通道", () => {
  beforeEach(() => {
    dialogStore.value = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    closeAllDialog();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("传入 payload：返回读写 API 且与选项上挂载的同源", () => {
    const channel = addDialog<Draft>({
      payload: emptyDraft(),
      contentRenderer: () => h("div")
    });
    const options = dialogStore.value[0] as DialogOptions<Draft>;
    expect(channel.getData()).toEqual({ name: "", member_pks: [] });
    expect(options.getData).toBe(channel.getData);
    expect(options.setData).toBe(channel.setData);
  });

  it("载荷字段不可枚举（避免 v-bind=options 把函数/对象透传到 DOM）", () => {
    addDialog<Draft>({
      payload: emptyDraft(),
      contentRenderer: () => h("div")
    });
    const options = dialogStore.value[0] as DialogOptions<Draft>;
    const keys = Object.keys(options);
    expect(keys).not.toContain("payload");
    expect(keys).not.toContain("getData");
    expect(keys).not.toContain("setData");
    // 不可枚举但可直接访问
    expect(options.payload).toEqual({ name: "", member_pks: [] });
    expect(typeof options.getData).toBe("function");
  });

  it("setData 支持覆盖与更新函数，getData 始终读到最新值", () => {
    const channel = addDialog<Draft>({
      payload: emptyDraft(),
      contentRenderer: () => h("div")
    });
    channel.setData({ name: "小组", member_pks: [1] });
    expect(channel.getData()).toEqual({ name: "小组", member_pks: [1] });
    channel.setData(prev => ({ ...prev, member_pks: [...prev.member_pks, 2] }));
    expect(channel.getData().member_pks).toEqual([1, 2]);
  });

  it("未传 payload：不建通道、返回 undefined、选项零污染", () => {
    const result = addDialog({ contentRenderer: () => h("div") });
    expect(result).toBeUndefined();
    const options = dialogStore.value[0];
    expect(options.getData).toBeUndefined();
    expect(options.setData).toBeUndefined();
    expect(options.payload).toBeUndefined();
  });

  it("渲染注入：传 payload 时内容组件经 props 收到 getData/setData 并可回写", async () => {
    const received: Array<Record<string, unknown>> = [];
    const Probe = defineComponent({
      name: "PayloadProbe",
      props: {
        getData: { type: Function, default: undefined },
        setData: { type: Function, default: undefined }
      },
      setup(props) {
        received.push({ getData: props.getData, setData: props.setData });
        return () => h("div", { class: "payload-probe" });
      }
    });
    const channel = addDialog<Draft>({
      payload: emptyDraft(),
      contentRenderer: () => h(Probe)
    });
    mountContainer();
    await nextTick();

    const injected = received.at(-1);
    expect(typeof injected?.getData).toBe("function");
    expect(typeof injected?.setData).toBe("function");
    // 内容组件回写后，打开方读到同一份数据
    (injected!.setData as (data: Draft) => void)({
      name: "回写",
      member_pks: [3]
    });
    expect(channel.getData()).toEqual({ name: "回写", member_pks: [3] });
  });

  it("未传 payload 的内容组件不被注入 getData/setData", async () => {
    const received: Array<Record<string, unknown>> = [];
    const Probe = defineComponent({
      name: "PlainProbe",
      props: {
        getData: { type: Function, default: undefined },
        setData: { type: Function, default: undefined }
      },
      setup(props) {
        received.push({ getData: props.getData, setData: props.setData });
        return () => h("div", { class: "plain-probe" });
      }
    });
    addDialog({ contentRenderer: () => h(Probe) });
    mountContainer();
    await nextTick();
    expect(received.at(-1)?.getData).toBeUndefined();
    expect(received.at(-1)?.setData).toBeUndefined();
  });
});
