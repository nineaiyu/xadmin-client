import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";
import { defineComponent, h, type PropType } from "vue";
import ReReadonlyTable from "../src/index.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      labels: { noData: "暂无数据" },
      tableA11y: { dataTable: "数据表" }
    }
  }
});

/** 表格替身：列替身按行渲染默认插槽（EP 表格在 jsdom 下不渲染单元格） */
const ElTableStub = defineComponent({
  name: "ElTable",
  props: {
    data: {
      type: Array as PropType<Record<string, unknown>[]>,
      default: () => []
    }
  },
  provide() {
    return { stubRows: this.data };
  },
  template: '<div class="stub-table"><slot /></div>'
});

const ElTableColumnStub = defineComponent({
  name: "ElTableColumn",
  props: {
    prop: { type: String, default: "" },
    label: { type: String, default: "" }
  },
  inject: { rows: { from: "stubRows", default: () => [] } },
  template:
    '<div class="stub-col" :data-prop="prop"><span class="stub-head">{{ label }}</span>' +
    '<span v-for="(row, index) in rows" :key="index" class="stub-cell">' +
    '<slot :row="row" :index="index">{{ row[prop] }}</slot></span></div>'
});

const ElPaginationStub = defineComponent({
  name: "ElPagination",
  emits: ["current-change"],
  template: '<button class="stub-page" @click="$emit(\'current-change\', 2)" />'
});

const global = {
  plugins: [i18n],
  directives: { loading: {} },
  stubs: {
    "el-table": ElTableStub,
    "el-table-column": ElTableColumnStub,
    "el-pagination": ElPaginationStub
  }
};

const columns = [
  { prop: "name", label: "名称" },
  { prop: "status", label: "状态", slot: "status" }
];

describe("ReReadonlyTable", () => {
  it("按列渲染表头，并把行数据交给列插槽", () => {
    const wrapper = mount(ReReadonlyTable, {
      props: { columns, rows: [{ pk: 1, name: "a", status: "ok" }] },
      slots: {
        status: ({ row }: { row: Record<string, unknown> }) =>
          h("span", { class: "status" }, String(row.status))
      },
      global
    });
    expect(wrapper.findAll(".stub-head").map(node => node.text())).toEqual([
      "名称",
      "状态"
    ]);
    expect(wrapper.find(".status").text()).toBe("ok");
  });

  it("指定分页时上抛 page-change（数据仍由父级拉取）", async () => {
    const wrapper = mount(ReReadonlyTable, {
      props: {
        columns: [{ prop: "name", label: "名称" }],
        rows: [{ pk: 1, name: "a" }],
        pagination: { total: 40, page: 1, pageSize: 20 }
      },
      global
    });
    await wrapper.find(".stub-page").trigger("click");
    expect(wrapper.emitted("page-change")?.[0]).toEqual([2]);
  });
});
