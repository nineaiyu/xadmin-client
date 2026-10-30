import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/dataset/datasets", () => ({
  datasetApi: { execute: vi.fn(), aggregate: vi.fn() }
}));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));

import { datasetApi, type DatasetItem } from "@/api/dataset/datasets";
import { message } from "@/utils/message";
import { useDatasetPreview } from "../datasetPreview";

const t = (key: string) => key;

const row: DatasetItem = {
  pk: "ds-1",
  name: "数据集",
  description: "",
  bound_model: "identity.userinfo",
  columns: ["amount|number", "hidden|number", "name"],
  numeric_columns: ["amount|number", "hidden|number"],
  filters: [],
  ordering: "",
  row_limit: 100,
  config: {},
  visibility: "shared"
};

describe("useDatasetPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("聚合数值候选只保留执行结果可见列", async () => {
    vi.mocked(datasetApi.execute).mockResolvedValue({
      code: 1000,
      data: { columns: ["amount|number", "name"], rows: [], total: 0 }
    } as never);
    const preview = useDatasetPreview({ t });

    await preview.openPreview(row);

    expect(preview.aggregateNumericColumns.value).toEqual(["amount|number"]);
  });

  it("网络失败给出独立错误文案且不打开预览", async () => {
    vi.mocked(datasetApi.execute).mockRejectedValue(new Error("offline"));
    const preview = useDatasetPreview({ t });

    await preview.openPreview(row);

    expect(message).toHaveBeenCalledWith("dataDataset.previewNetworkFailed", {
      type: "error"
    });
    expect(preview.previewDialog.value).toBe(false);
  });

  it("业务失败优先展示服务端 detail", async () => {
    vi.mocked(datasetApi.execute).mockResolvedValue({
      code: 400,
      detail: "字段不可用"
    } as never);
    const preview = useDatasetPreview({ t });

    await preview.openPreview(row);

    expect(message).toHaveBeenCalledWith("字段不可用", { type: "warning" });
    expect(preview.previewDialog.value).toBe(false);
  });
});
