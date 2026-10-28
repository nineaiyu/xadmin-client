import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/dataset/datasets", () => ({
  datasetApi: { execute: vi.fn() }
}));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  };
});

import { datasetApi } from "@/api/dataset/datasets";
import ReportTablePreview from "../ReportTablePreview.vue";

/**
 * 明细表预览：取数上限下推。
 *
 * 预览请求带 `max_rows = 展示行数上限`（服务端与数据集 row_limit 取小者下推 SQL），
 * 不再按数据集 row_limit 物化全量行后本地切片；上限调大且已取行不够时补拉。
 */

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ amount: index }));

/** DataTable 桩：捕获行数据（断言本地重切不重拉的展示行数） */
const DataTableStub = defineComponent({
  name: "DataTableStub",
  props: { data: { type: Array, default: () => [] } },
  template: '<div class="data-table-stub" :data-rows="data.length" />'
});

const mountPreview = (limit = 50) =>
  mount(ReportTablePreview, {
    props: { datasetPk: "ds1", columns: [], limit },
    global: {
      stubs: { DataTable: DataTableStub, "el-table-column": true },
      directives: { loading: {} }
    }
  });

const dataTableOf = (wrapper: ReturnType<typeof mountPreview>) =>
  wrapper.findComponent(DataTableStub);

describe("ReportTablePreview", () => {
  it("预览请求带 max_rows = 展示行数上限（不全量物化后切片）", async () => {
    vi.mocked(datasetApi.execute).mockResolvedValue({
      code: 1000,
      detail: "",
      data: { columns: ["amount"], rows: rows(50), total: 500, limit: 50 }
    });
    const wrapper = mountPreview(50);
    await flushPromises();
    expect(vi.mocked(datasetApi.execute)).toHaveBeenCalledWith("ds1", {
      max_rows: 50
    });
    expect(dataTableOf(wrapper).props("data")).toHaveLength(50);
  });

  it("上限调小：本地重切已取行，不重新请求", async () => {
    vi.mocked(datasetApi.execute).mockResolvedValue({
      code: 1000,
      detail: "",
      data: { columns: ["amount"], rows: rows(50), total: 500, limit: 50 }
    });
    const wrapper = mountPreview(50);
    await flushPromises();
    await wrapper.setProps({ limit: 20 });
    await flushPromises();
    expect(vi.mocked(datasetApi.execute)).toHaveBeenCalledTimes(1);
    expect(dataTableOf(wrapper).props("data")).toHaveLength(20);
  });

  it("上限调大超出已取行数且还有更多数据：按新上限补拉", async () => {
    vi.mocked(datasetApi.execute).mockResolvedValue({
      code: 1000,
      detail: "",
      data: { columns: ["amount"], rows: rows(50), total: 500, limit: 50 }
    });
    const wrapper = mountPreview(50);
    await flushPromises();
    await wrapper.setProps({ limit: 200 });
    await flushPromises();
    expect(vi.mocked(datasetApi.execute)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(datasetApi.execute)).toHaveBeenLastCalledWith("ds1", {
      max_rows: 200
    });
  });

  it("上限调大但服务端没有更多数据：不补拉", async () => {
    vi.mocked(datasetApi.execute).mockResolvedValue({
      code: 1000,
      detail: "",
      data: { columns: ["amount"], rows: rows(30), total: 30, limit: 50 }
    });
    const wrapper = mountPreview(30);
    await flushPromises();
    await wrapper.setProps({ limit: 100 });
    await flushPromises();
    expect(vi.mocked(datasetApi.execute)).toHaveBeenCalledTimes(1);
  });
});
