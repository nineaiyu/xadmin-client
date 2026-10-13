import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { ElButton, ElDrawer, ElPopconfirm } from "element-plus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";

import { addDrawer, closeAllDrawer, drawerStore, ReDrawer } from "../index";
import type { DrawerOptions } from "../type";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": { buttons: { cancel: "取消", save: "保存" } }
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

type Draft = { name: string; member_pks: number[] };
const emptyDraft = (): Draft => ({ name: "", member_pks: [] });

/**
 * 载荷通道（类型化跨组件数据）：
 * 与 ReDialog 的对应 spec 同构——两套弹层体系各自自足实现，同构由用例对齐。
 */
describe("ReDrawer 类型化载荷通道", () => {
  beforeEach(() => {
    drawerStore.value = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    closeAllDrawer();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("传入 payload：返回读写 API 且与选项上挂载的同源", () => {
    const channel = addDrawer<Draft>({
      payload: emptyDraft(),
      contentRenderer: () => h("div")
    });
    const options = drawerStore.value[0] as DrawerOptions<Draft>;
    expect(channel.getData()).toEqual({ name: "", member_pks: [] });
    expect(options.getData).toBe(channel.getData);
    expect(options.setData).toBe(channel.setData);
  });

  it("载荷字段不可枚举（避免 v-bind=options 把函数/对象透传到 DOM）", () => {
    addDrawer<Draft>({
      payload: emptyDraft(),
      contentRenderer: () => h("div")
    });
    const options = drawerStore.value[0] as DrawerOptions<Draft>;
    const keys = Object.keys(options);
    expect(keys).not.toContain("payload");
    expect(keys).not.toContain("getData");
    expect(keys).not.toContain("setData");
    expect(options.payload).toEqual({ name: "", member_pks: [] });
    expect(typeof options.getData).toBe("function");
  });

  it("setData 支持覆盖与更新函数，getData 始终读到最新值", () => {
    const channel = addDrawer<Draft>({
      payload: emptyDraft(),
      contentRenderer: () => h("div")
    });
    channel.setData({ name: "小组", member_pks: [1] });
    expect(channel.getData()).toEqual({ name: "小组", member_pks: [1] });
    channel.setData(prev => ({ ...prev, member_pks: [...prev.member_pks, 2] }));
    expect(channel.getData().member_pks).toEqual([1, 2]);
  });

  it("未传 payload：不建通道、返回 undefined、选项零污染", () => {
    const result = addDrawer({ contentRenderer: () => h("div") });
    expect(result).toBeUndefined();
    const options = drawerStore.value[0];
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
    const channel = addDrawer<Draft>({
      payload: emptyDraft(),
      contentRenderer: () => h(Probe)
    });
    mountContainer();
    await nextTick();

    const injected = received.at(-1);
    expect(typeof injected?.getData).toBe("function");
    expect(typeof injected?.setData).toBe("function");
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
    addDrawer({ contentRenderer: () => h(Probe) });
    mountContainer();
    await nextTick();
    expect(received.at(-1)?.getData).toBeUndefined();
    expect(received.at(-1)?.setData).toBeUndefined();
  });
});
