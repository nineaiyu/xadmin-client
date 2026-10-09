import { h } from "vue";
import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { statusTagProps, type StatusTagType } from "@/utils/dict";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import { relatedPk, type ReportItem } from "@/api/dataset/analysis";
import type { DatasetItem } from "@/api/dataset/datasets";
import { channelLabelKey } from "./channels";

/** 最近执行状态兜底配色（后端值：SUCCESS* / FAILURE / 空） */
const REPORT_STATUS_TAG: Record<string, StatusTagType> = {
  SUCCESS: "success",
  // 投递失败（任一渠道）：SUCCESS_WITH_DELIVERY_ERROR 为通用口径，
  // SUCCESS_WITH_EMAIL_ERROR 为存量行兼容
  SUCCESS_WITH_DELIVERY_ERROR: "warning",
  SUCCESS_WITH_EMAIL_ERROR: "warning",
  FAILURE: "danger"
};

/** LabeledChoiceField（如 frequency）取展示文案：对象取 label，标量原样 */
const dictLabel = (raw: unknown): string => {
  if (raw && typeof raw === "object") {
    const item = raw as { value?: string; label?: string };
    return item.label ?? String(item.value ?? "");
  }
  return String(raw ?? "");
};

/**
 * 报表列表列渲染（自 hook.tsx 抽出，行数门禁）：数据集名称 / 频率 / 收件人 /
 * 投放渠道 / 最近执行状态。dataset 列接口下发 `{pk,label}` 关联对象（label 与
 * pk 同值）：取 pk 后用数据集清单映射名称展示。
 */
export function useReportColumns({
  datasets
}: {
  datasets: Ref<DatasetItem[]>;
}) {
  const { t } = useI18n();

  const datasetName = (value: ReportItem["dataset"]) => {
    const pk = relatedPk(value);
    return datasets.value.find(item => item.pk === pk)?.name ?? pk;
  };

  /** 投递渠道展示：空 = 仅邮件（存量兼容）；未知取值原样回显（值集单源在后端） */
  const channelLabels = (channels: string[] | undefined) =>
    (channels?.length ? channels : ["email"])
      .map(item => {
        const key = channelLabelKey(item);
        return key ? t(key) : item;
      })
      .join(", ");

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      dataset: column => {
        column["minWidth"] = 140;
        column["cellRenderer"] = ({ row }) =>
          h("span", datasetName((row as ReportItem).dataset));
      },
      frequency: column => {
        column["cellRenderer"] = ({ row }) =>
          h("span", dictLabel((row as ReportItem).frequency));
      },
      recipients: column => {
        column["minWidth"] = 180;
        column["cellRenderer"] = ({ row }) =>
          h("span", ((row as ReportItem).recipients || []).join(", ") || "—");
      },
      notify_channels: column => {
        column["cellRenderer"] = ({ row }) =>
          h("span", channelLabels((row as ReportItem).notify_channels));
      },
      last_status: column => {
        column["cellRenderer"] = ({ row }) => {
          const status = (row as ReportItem).last_status;
          if (!status) return h("span", "-");
          return h(
            ElTag,
            { size: "small", ...statusTagProps(status, REPORT_STATUS_TAG) },
            () => dictLabel(status)
          );
        };
      }
    });

  return { listColumnsFormat };
}
