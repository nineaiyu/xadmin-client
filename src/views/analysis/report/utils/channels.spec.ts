import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchReportChannels = vi.fn();

vi.mock("@/api/dataset/analysis", () => ({
  fetchReportChannels: () => fetchReportChannels()
}));

import {
  FALLBACK_CHANNEL_VALUES,
  FALLBACK_IM_CHANNEL_VALUES,
  channelLabelKey,
  loadReportChannels
} from "./channels";

describe("channels", () => {
  beforeEach(() => {
    fetchReportChannels.mockReset();
  });

  it("后端下发值集时以其为准（含 IM 子集，不再隐式推导）", async () => {
    fetchReportChannels.mockResolvedValue({
      code: 1000,
      choices_dict: {
        notify_channels: ["email", "feishu", "telegram"],
        im_notify_channels: ["feishu", "telegram"]
      }
    });
    const set = await loadReportChannels();
    expect(set).toEqual({
      channels: ["email", "feishu", "telegram"],
      imChannels: ["feishu", "telegram"],
      fromServer: true
    });
  });

  it("元数据不可达时回落兜底清单（表单保持可用）", async () => {
    fetchReportChannels.mockRejectedValue(new Error("network down"));
    const set = await loadReportChannels();
    expect(set.channels).toEqual(FALLBACK_CHANNEL_VALUES);
    expect(set.imChannels).toEqual(FALLBACK_IM_CHANNEL_VALUES);
    expect(set.fromServer).toBe(false);
  });

  it("业务码非成功时同样回落兜底清单", async () => {
    fetchReportChannels.mockResolvedValue({ code: 1001, choices_dict: {} });
    const set = await loadReportChannels();
    expect(set.fromServer).toBe(false);
    expect(set.channels).toEqual(FALLBACK_CHANNEL_VALUES);
  });

  it("文案映射：已知取值给 i18n key，未知取值回显原文", () => {
    expect(channelLabelKey("email")).toBe("dataReport.channelEmail");
    expect(channelLabelKey("telegram")).toBeUndefined();
  });
});
