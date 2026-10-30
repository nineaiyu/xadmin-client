import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref, type Ref } from "vue";

import type { DashboardDataPayload } from "@/utils/websocket/protocol";
import {
  applyDashboardFrame,
  useDashboardChannel
} from "../useDashboardChannel";

/**
 * 仪表盘实时推送通道：实时档开合驱动 WS 连接（切盘重连 / 关档断开）、
 * dashboard_data 帧过滤转发（非 1000 / 非 dashboard_data 丢弃）、
 * 帧路由（cards 注入 + errors 同通道）。
 */

const state = vi.hoisted(() => ({
  instances: [] as Array<{
    url: string;
    handler: ((data: unknown) => void) | null;
    closed: boolean;
  }>
}));

vi.mock("@/utils/websocket", () => ({
  WS: class {
    url: string;
    handler: ((data: unknown) => void) | null = null;
    closed = false;
    constructor(url: string) {
      this.url = url;
      state.instances.push(this);
    }
    onMessage(callback: (data: unknown) => void) {
      this.handler = callback;
    }
    close() {
      this.closed = true;
    }
  }
}));

const FRAME: DashboardDataPayload = {
  dashboard: "dsb-1",
  cards: [{ card: "c1", kind: "execute", data: { total: 7 } }],
  errors: [{ card: "c2", detail: "无权限" }],
  ts: 1
};

function mountChannel(deps: {
  enabled: Ref<boolean>;
  dashboardPk: Ref<string | null>;
}) {
  const applied: DashboardDataPayload[] = [];
  const Harness = defineComponent({
    setup() {
      useDashboardChannel({
        enabled: deps.enabled,
        dashboardPk: deps.dashboardPk,
        applyFrame: frame => applied.push(frame)
      });
      return () => null;
    }
  });
  mount(Harness);
  return applied;
}

describe("useDashboardChannel", () => {
  it("实时档 + 选中盘：连接 ws/dashboard/<pk>", () => {
    state.instances = [];
    mountChannel({ enabled: ref(true), dashboardPk: ref("dsb-1") });
    expect(state.instances).toHaveLength(1);
    expect(state.instances[0].url).toContain("/ws/dashboard/dsb-1");
  });

  it("未选中盘 / 关闭实时档：不连接；开档连接、关档断开", async () => {
    state.instances = [];
    const enabled = ref(false);
    const pk = ref<string | null>("dsb-1");
    mountChannel({ enabled, dashboardPk: pk });
    expect(state.instances).toHaveLength(0);

    enabled.value = true;
    await nextTick();
    expect(state.instances).toHaveLength(1);

    enabled.value = false;
    await nextTick();
    expect(state.instances[0].closed).toBe(true);
  });

  it("切盘重连：旧连接关闭，新连接指向新盘", async () => {
    state.instances = [];
    const enabled = ref(true);
    const pk = ref<string | null>("dsb-1");
    mountChannel({ enabled, dashboardPk: pk });
    pk.value = "dsb-2";
    await nextTick();
    expect(state.instances).toHaveLength(2);
    expect(state.instances[0].closed).toBe(true);
    expect(state.instances[1].url).toContain("/ws/dashboard/dsb-2");
  });

  it("仅 dashboard_data 业务成功帧转发给 applyFrame", () => {
    state.instances = [];
    const applied = mountChannel({
      enabled: ref(true),
      dashboardPk: ref("dsb-1")
    });
    const handler = state.instances[0].handler!;
    handler({ action: "dashboard_data", code: 1000, data: FRAME });
    handler({ action: "dashboard_data", code: 1001, detail: "失败" });
    handler({ action: "screen_data", code: 1000, data: FRAME });
    handler("garbage");
    expect(applied).toEqual([FRAME]);
  });
});

describe("applyDashboardFrame", () => {
  it("cards 按卡片 id 注入，errors 走同一通道", () => {
    const applied: Array<Record<string, unknown>> = [];
    const cards: Record<
      string,
      { applyData?: (entry: Record<string, unknown>) => void }
    > = {
      c1: { applyData: entry => applied.push(entry) },
      c2: { applyData: entry => applied.push(entry) }
    };
    applyDashboardFrame(FRAME, cards);
    expect(applied).toEqual([
      { card: "c1", kind: "execute", data: { total: 7 } },
      { card: "c2", detail: "无权限" }
    ]);
  });

  it("无句柄 / 缺 applyData 的卡片静默跳过", () => {
    expect(() =>
      applyDashboardFrame(FRAME, { c1: undefined, c2: {} })
    ).not.toThrow();
  });
});
