import { flushPromises, mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it, vi } from "vitest";
import { computed, defineComponent, type PropType } from "vue";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/api/audit/logs/operation", () => ({
  operationLogApi: { list: mocks.list }
}));

import Component from "../src/components/ChangeHistoryDialog.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      changeHistory: {
        time: "时间",
        operator: "操作人",
        method: "方式",
        statusCode: "状态码",
        changes: "变更内容"
      }
    }
  }
});

/** 表格替身：列替身把默认插槽按行渲染（EP 表格在 jsdom 下不渲染单元格） */
const ElTableStub = defineComponent({
  name: "ElTable",
  props: {
    data: {
      type: Array as PropType<Record<string, unknown>[]>,
      default: () => [] as Record<string, unknown>[]
    }
  },
  provide() {
    // 行数据异步到达：以 computed 传递，列替身读到的才是最新行集
    return { stubTableRows: computed(() => this.data) };
  },
  template: '<div class="stub-table"><slot /></div>'
});

const ElTableColumnStub = defineComponent({
  name: "ElTableColumn",
  props: {
    prop: { type: String, default: "" },
    label: { type: String, default: "" }
  },
  inject: { rows: { from: "stubTableRows", default: () => [] } },
  template:
    '<div class="stub-col"><span v-for="(row, index) in rows" :key="index" class="stub-cell">' +
    '<slot :row="row" /></span></div>'
});

const ReJsonViewerStub = defineComponent({
  name: "ReJsonViewer",
  props: { value: { type: [Object, Array], default: null } },
  template: '<div class="stub-json">{{ JSON.stringify(value) }}</div>'
});

const stubs = {
  "el-table": ElTableStub,
  "el-table-column": ElTableColumnStub,
  "el-pagination": { name: "ElPagination", template: "<div />" },
  "el-icon": { name: "ElIcon", template: "<span><slot /></span>" },
  "el-tag": { name: "ElTag", template: "<span><slot /></span>" },
  ReJsonViewer: ReJsonViewerStub,
  IconifyIconOffline: { name: "IconifyIconOffline", template: "<span />" }
};

const mountDialog = async (changes: unknown) => {
  mocks.list.mockResolvedValue({
    code: 1000,
    data: {
      results: [
        {
          pk: "1",
          method: "PATCH",
          status_code: 200,
          creator: { username: "admin" },
          changes,
          created_time: "2026-10-11 10:00"
        }
      ],
      total: 1
    }
  });
  const wrapper = mount(Component, {
    props: { baseApi: "/api/identity/user", pk: 7 },
    global: { plugins: [i18n], stubs }
  });
  await flushPromises();
  return wrapper;
};

describe("ChangeHistoryDialog 变更历史", () => {
  it("按 object_pk + path 前缀拉取并渲染行", async () => {
    const wrapper = await mountDialog({
      nickname: { old: "旧名", new: "新名" }
    });
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ object_pk: "7", path: "/api/identity/user/" })
    );
    expect(wrapper.find(".stub-table").exists()).toBe(true);
  });

  it("标量变更走内联 old→new 文本 diff", async () => {
    const wrapper = await mountDialog({
      nickname: { old: "旧名", new: "新名" }
    });
    expect(wrapper.text()).toContain("旧名");
    expect(wrapper.text()).toContain("新名");
    expect(wrapper.find(".stub-json").exists()).toBe(false);
  });

  it("JSON 文本（对象/数组）改走结构化查看器，值为解析后的对象", async () => {
    const wrapper = await mountDialog({
      roles: { old: '["a"]', new: '["a","b"]' },
      extra: { old: null, new: '{"k":1}' }
    });
    const viewers = wrapper.findAll(".stub-json");
    expect(viewers).toHaveLength(2);
    expect(viewers[0].text()).toBe('{"old":["a"],"new":["a","b"]}');
    expect(viewers[1].text()).toBe('{"old":null,"new":{"k":1}}');
  });

  it("changes 已是对象（旧口径）同样可解析；空 changes 显示占位", async () => {
    const parsed = await mountDialog({
      tags: { old: null, new: ["x"] }
    });
    expect(parsed.findAll(".stub-json")).toHaveLength(1);

    const empty = await mountDialog(null);
    expect(empty.text()).toContain("—");
  });
});
