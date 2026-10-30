import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/dataset/analysis", () => ({
  rollbackReport: vi.fn()
}));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));

import { rollbackReport, type ReportItem } from "@/api/dataset/analysis";
import type { DatasetItem } from "@/api/dataset/datasets";
import { message } from "@/utils/message";
import { createReportVersionActions } from "../reportVersions";

const report = (): ReportItem => ({
  pk: "r1",
  name: "报表",
  dataset: "d1",
  mode: "rows",
  group_by: "",
  metric: "count",
  date_trunc: "",
  value_field: "",
  design: { columns: ["username"], table_limit: 20, components: [] },
  design_version: 2,
  frequency: "daily",
  send_time: "08:00",
  weekday: 0,
  month_day: 1,
  cron_expression: "",
  recipients: ["a@example.com"],
  notify_channels: ["email"],
  im_recipients: [],
  is_active: true,
  last_run_at: null,
  last_status: ""
});

const dataset = {
  pk: "d1",
  name: "数据集",
  columns: ["username", "gender"]
} as DatasetItem;

describe("createReportVersionActions：回滚", () => {
  it("成功后回填设计并清除未保存标记", async () => {
    const target = ref<ReportItem | null>(report());
    const design = ref(target.value!.design!);
    const dirty = ref(true);
    const { rollbackTo } = createReportVersionActions({
      t: key => key,
      report: target,
      dataset: ref<DatasetItem | null>(dataset),
      design,
      saving: ref(false),
      dirty,
      readonly: ref(false),
      datasetMissing: ref(false)
    });
    vi.mocked(rollbackReport).mockResolvedValue({
      code: 1000,
      detail: "",
      data: {
        ...report(),
        design_version: 3,
        design: { columns: ["gender"], table_limit: 50, components: [] }
      }
    });
    expect(await rollbackTo(1)).toBe(true);
    expect(design.value.columns).toEqual(["gender"]);
    expect(dirty.value).toBe(false);
    expect(target.value?.design_version).toBe(3);
    expect(vi.mocked(message)).toHaveBeenCalledWith(
      "dataReport.versionRolledBack",
      expect.anything()
    );
  });

  it("失败保留草稿并提示原因", async () => {
    const target = ref<ReportItem | null>(report());
    const design = ref(target.value!.design!);
    const dirty = ref(true);
    const { rollbackTo } = createReportVersionActions({
      t: key => key,
      report: target,
      dataset: ref<DatasetItem | null>(dataset),
      design,
      saving: ref(false),
      dirty,
      readonly: ref(false),
      datasetMissing: ref(false)
    });
    vi.mocked(rollbackReport).mockResolvedValue({
      code: 1001,
      detail: "Report version not found",
      data: null as never
    });
    expect(await rollbackTo(99)).toBe(false);
    expect(design.value.columns).toEqual(["username"]);
    expect(dirty.value).toBe(true);
    expect(vi.mocked(message)).toHaveBeenCalledWith(
      "Report version not found",
      expect.anything()
    );
  });
});
