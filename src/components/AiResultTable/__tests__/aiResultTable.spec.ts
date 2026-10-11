import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";
import { defineComponent, type PropType } from "vue";

import Component from "../index.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      ai: {
        thinkingRunning: "思考中…",
        thinkingDone: "已思考 · {count} 字",
        sources: "参考来源",
        resultName: "名称",
        resultValue: "值",
        resultRows: "共 {count} 行，展示 {shown} 行"
      },
      chat: {
        loadMore: "加载更早",
        noMoreHistory: "没有更多历史消息",
        actionCardTitle: "执行「{label}」",
        actionConfirm: "确认执行",
        actionCancel: "取消",
        actionRetry: "重试",
        actionDone: "执行完成",
        actionPending: "已提交审批",
        actionCancelled: "已取消",
        actionNeedApproval: "需审批",
        yes: "是",
        no: "否"
      },
      reState: { empty: "暂无数据", error: "加载失败" },
      apiScope: { other: "其他" }
    }
  }
});

/**
 * 表格替身：列替身把默认插槽按行渲染（沿真实 props 走组件内的 valueOf 格式化），
 * 表体行数经 provide/inject 传递——EP 表格在 jsdom 下不做布局测量、不渲染单元格。
 */
const ElTableStub = defineComponent({
  name: "ElTable",
  props: {
    data: {
      type: Array as PropType<Record<string, unknown>[]>,
      default: () => [] as Record<string, unknown>[]
    }
  },
  provide() {
    return { stubTableRows: this.data };
  },
  template: '<div class="stub-table"><slot /></div>'
});

const ElTableColumnStub = {
  name: "ElTableColumn",
  props: {
    prop: { type: String, default: "" },
    label: { type: String, default: "" }
  },
  inject: { rows: { from: "stubTableRows", default: () => [] } },
  template:
    '<div class="stub-col"><span class="stub-head">{{ label }}</span>' +
    '<span v-for="(row, index) in rows" :key="index" class="stub-cell"><slot :row="row" /></span></div>'
};

const stubs = { "el-table": ElTableStub, "el-table-column": ElTableColumnStub };

const mountTable = (data: Record<string, unknown>) =>
  mount(Component, { props: { data }, global: { plugins: [i18n], stubs } });

describe("AiResultTable 只读结果表", () => {
  it("columns/rows 形态：表头取列名，单元格走对象序列化", () => {
    const wrapper = mountTable({
      columns: ["name", "meta"],
      rows: [{ name: "a", meta: { x: 1 } }],
      total: 5
    });
    expect(wrapper.text()).toContain("共 5 行，展示 1 行");
    expect(wrapper.findAll(".stub-head").map(node => node.text())).toEqual([
      "name",
      "meta"
    ]);
    expect(wrapper.findAll(".stub-cell").map(node => node.text())).toEqual([
      "a",
      '{"x":1}'
    ]);
  });

  it("series 形态：转成 name/value 两列", () => {
    const wrapper = mountTable({ series: [{ name: "一月", value: 3 }] });
    expect(wrapper.findAll(".stub-head").map(node => node.text())).toEqual([
      "name",
      "value"
    ]);
    expect(wrapper.findAll(".stub-cell").map(node => node.text())).toEqual([
      "一月",
      "3"
    ]);
  });

  it("results 形态：列取首行键并剔除 pk", () => {
    const wrapper = mountTable({ results: [{ pk: "1", username: "xadmin" }] });
    expect(wrapper.findAll(".stub-head").map(node => node.text())).toEqual([
      "username"
    ]);
    expect(wrapper.findAll(".stub-cell").map(node => node.text())).toEqual([
      "xadmin"
    ]);
  });

  it("键值兜底：metrics 摊平成两列键值表", () => {
    const metrics = mountTable({ metrics: { users: 12, online: 3 } });
    expect(metrics.find(".stub-table").exists()).toBe(true);
    expect(metrics.text()).toContain("共 2 行，展示 2 行");
    // 单元格按「列优先」铺开（第一列全部行在前）
    expect(metrics.findAll(".stub-head").map(node => node.text())).toEqual([
      "名称",
      "值"
    ]);
    expect(metrics.findAll(".stub-cell").map(node => node.text())).toEqual([
      "users",
      "online",
      "12",
      "3"
    ]);
  });

  it("无可成表结构时不渲染", () => {
    const wrapper = mountTable({
      big: Array.from({ length: 40 }, (_, i) => i)
    });
    const nested = mountTable({ results: [{ pk: "1" }] });
    expect(wrapper.find('[data-testid="ai-result-table"]').exists()).toBe(
      false
    );
    expect(nested.find('[data-testid="ai-result-table"]').exists()).toBe(false);
  });
});
