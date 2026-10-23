import { flushPromises, mount } from "@vue/test-utils";
import { h, nextTick } from "vue";
import {
  ElEmpty,
  ElLoading,
  ElPagination,
  ElTable,
  ElTableColumn
} from "element-plus";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

import ReReadonlyTable from "./index.vue";

const columns = [{ prop: "name", label: "Name" }];
const rows = [{ pk: 1, name: "alpha" }];

const mountTable = (props: Record<string, unknown> = {}, slots = {}) =>
  mount(ReReadonlyTable, {
    props: { columns, rows, ...props },
    slots,
    global: {
      components: { ElEmpty, ElPagination, ElTable, ElTableColumn },
      directives: { loading: ElLoading.directive }
    }
  });

describe("ReReadonlyTable 分页与展开行", () => {
  it("传入 pagination 时渲染分页器并上报 page-change", async () => {
    const wrapper = mountTable({
      pagination: { total: 30, page: 1, pageSize: 10 }
    });
    await flushPromises();

    const pagination = wrapper.findComponent(ElPagination);
    expect(pagination.exists()).toBe(true);

    pagination.vm.$emit("current-change", 2);
    await nextTick();

    expect(wrapper.emitted("page-change")).toEqual([[2]]);
    expect(pagination.props("total")).toBe(30);
    expect(pagination.props("pageSize")).toBe(10);
  });

  it("未传 pagination 时不渲染分页器", () => {
    const wrapper = mountTable();
    expect(wrapper.find(".el-pagination").exists()).toBe(false);
  });

  it("提供 expand 插槽时渲染展开列与插槽内容", async () => {
    const wrapper = mountTable(
      {},
      {
        expand: (scope: { row: { pk: number } }) =>
          h("div", { class: "expand-body" }, `detail-${scope.row.pk}`)
      }
    );
    await flushPromises();

    const toggle = wrapper.find(".el-table__expand-icon");
    expect(toggle.exists()).toBe(true);

    await toggle.trigger("click");
    await flushPromises();

    expect(wrapper.find(".expand-body").text()).toBe("detail-1");
  });

  it("未提供 expand 插槽时不渲染展开列", () => {
    const wrapper = mountTable();
    expect(wrapper.find(".el-table__expand-icon").exists()).toBe(false);
  });

  it("emptyText 透传给统一空态", () => {
    const wrapper = mountTable({ rows: [], emptyText: "none" });
    expect(wrapper.find(".el-empty__description").text()).toBe("none");
  });
});
