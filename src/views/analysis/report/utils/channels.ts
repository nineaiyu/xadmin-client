import { fetchReportChannels } from "@/api/dataset/analysis";
import { SUCCESS_CODE } from "@/api/types";

/**
 * 报表投递渠道：**值集单源在后端**（`dataset/serializers/analysis.py` 的
 * `REPORT_NOTIFY_CHANNELS` / `IM_NOTIFY_CHANNELS`，经 `reports/choices` 下发），
 * 前端只承载展示文案与「元数据不可达」的兜底清单。
 */

/** 渠道展示文案（值 → i18n key）：未知取值原样回显，后端新增渠道时前端不空白 */
const CHANNEL_LABEL_KEYS: Record<string, string> = {
  email: "dataReport.channelEmail",
  dingtalk: "dataReport.channelDingtalk",
  wecom: "dataReport.channelWecom",
  feishu: "dataReport.channelFeishu"
};

/** 兜底值集（仅当 choices 不可达时使用；枚举定义始终在后端） */
export const FALLBACK_CHANNEL_VALUES = ["email", "dingtalk", "wecom", "feishu"];
export const FALLBACK_IM_CHANNEL_VALUES = ["dingtalk", "wecom", "feishu"];

export type ReportChannelSet = {
  /** 全部可选渠道 */
  channels: string[];
  /** IM 渠道子集（后端显式下发，不再按「非 email」隐式推导） */
  imChannels: string[];
  /** 是否来自后端元数据（false = 兜底清单） */
  fromServer: boolean;
};

export const channelLabelKey = (value: string): string | undefined =>
  CHANNEL_LABEL_KEYS[value];

/** 加载渠道枚举：元数据不可达时回落兜底清单——表单不因 choices 失败而不可用 */
export async function loadReportChannels(): Promise<ReportChannelSet> {
  const res = await fetchReportChannels().catch(() => null);
  const dict = res?.code === SUCCESS_CODE ? res.choices_dict : undefined;
  const channels = dict?.notify_channels ?? [];
  const imChannels = dict?.im_notify_channels ?? [];
  if (!channels.length || !imChannels.length) {
    return {
      channels: [...FALLBACK_CHANNEL_VALUES],
      imChannels: [...FALLBACK_IM_CHANNEL_VALUES],
      fromServer: false
    };
  }
  return {
    channels: [...channels],
    imChannels: [...imChannels],
    fromServer: true
  };
}
