import { flushPromises, shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  message: vi.fn(),
  fetchAllRows: vi.fn()
}));

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  };
});
vi.mock("@/utils/message", () => ({ message: mocks.message }));
vi.mock("@/utils/fetchAllRows", () => ({ fetchAllRows: mocks.fetchAllRows }));
vi.mock("@/api/identity/role", () => ({
  roleApi: { list: Symbol("roleList") }
}));

import CardForm from "./CardForm.vue";
import type { DashboardCard, DatasetItem } from "@/api/dataset/datasets";

const dataset = (dateField?: string): DatasetItem => ({
  pk: "ds-1",
  name: "数据集",
  description: "",
  bound_model: "demo.book",
  columns: ["name", "created_time"],
  filters: [],
  ordering: "",
  row_limit: 100,
  config: dateField ? { date_field: dateField } : {},
  visibility: "shared"
});

const card: DashboardCard = {
  id: "c1",
  dataset: "ds-1",
  title: "趋势",
  chart_type: "line",
  group_by: "name"
};

const mountForm = (ds: DatasetItem) =>
  shallowMount(CardForm, {
    props: { card, datasets: [ds] }
  });

beforeEach(() => {
  mocks.message.mockReset();
  mocks.fetchAllRows.mockResolvedValue({ code: 1000, data: { results: [] } });
});

describe("仪表盘折线卡日期字段校验", () => {
  it("数据集无日期字段：line 卡保存被拦截并提示", async () => {
    const wrapper = mountForm(dataset());
    await flushPromises();

    expect(wrapper.vm.getPayload()).toBeNull();
    expect(mocks.message).toHaveBeenCalledWith("dashboard.lineRequiresDate", {
      type: "warning"
    });
  });

  it("数据集配置日期字段：line 卡可正常保存", async () => {
    const wrapper = mountForm(dataset("created_time"));
    await flushPromises();

    expect(wrapper.vm.getPayload()).toMatchObject({
      chart_type: "line",
      group_by: "name"
    });
  });
});
