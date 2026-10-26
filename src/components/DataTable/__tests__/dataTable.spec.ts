import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent } from "vue";
import DataTable from "../src/index.vue";

/** EP 表格在 jsdom 下不渲染原生 table：替身补两张原生表供 a11y 同步断言 */
const ElTableStub = defineComponent({
  name: "ElTable",
  template:
    '<div class="stub-table">' +
    '<table class="el-table__header"></table>' +
    '<table class="el-table__body"></table>' +
    "<slot />" +
    "</div>"
});

const stubs = { "el-table": ElTableStub };
const global = { stubs };

describe("DataTable", () => {
  it("透传 attrs（data 等）到内部表格", () => {
    const data = [{ pk: 1, name: "a" }];
    const wrapper = mount(DataTable, {
      props: { label: "用户表" },
      attrs: { "data-testid": "users-table", data },
      global
    });
    const table = wrapper.findComponent(ElTableStub);
    expect(table.attributes("data-testid")).toBe("users-table");
  });

  it("挂载后为原生表补可访问名与说明关联", async () => {
    const wrapper = mount(DataTable, {
      props: { label: "用户表", desc: "当前筛选下的用户" },
      global,
      attachTo: document.body
    });
    await flushPromises();
    const tables = wrapper.findAll("table");
    expect(tables).toHaveLength(2);
    tables.forEach(table => {
      expect(table.attributes("aria-label")).toBe("用户表");
      expect(table.attributes("aria-describedby")).toBeTruthy();
    });
    expect(
      wrapper.find("[data-table-a11y-desc]").attributes("data-table-a11y-desc")
    ).toBe("当前筛选下的用户");
    wrapper.unmount();
  });

  it("转发默认插槽内容", () => {
    const wrapper = mount(DataTable, {
      slots: { default: "<span class='cell'>cell</span>" },
      global
    });
    expect(wrapper.find(".cell").text()).toBe("cell");
  });
});
