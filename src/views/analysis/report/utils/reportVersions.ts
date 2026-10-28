import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import type { DatasetItem } from "@/api/dataset/datasets";
import {
  rollbackReport,
  type ReportDesign,
  type ReportItem
} from "@/api/dataset/analysis";
import { normalizeDesign } from "./design";
import { normalizeError } from "@/utils/apiError";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 报表历史版本动作：回滚到指定设计版本并同步本地状态。
 *
 * 与保存共用同一组状态（report/design/saving/dirty），回滚成功即视为已保存；
 * 失败保留当前草稿并给出可读提示。独立成文件以守住 hook 行数门禁。
 */
export function createReportVersionActions(deps: {
  t: TFunction;
  report: Ref<ReportItem | null>;
  dataset: Ref<DatasetItem | null>;
  design: Ref<ReportDesign>;
  saving: Ref<boolean>;
  dirty: Ref<boolean>;
  readonly: Ref<boolean>;
  datasetMissing: Ref<boolean>;
}) {
  const { t } = deps;

  async function rollbackTo(version: number): Promise<boolean> {
    if (
      !deps.report.value ||
      deps.saving.value ||
      deps.readonly.value ||
      deps.datasetMissing.value
    )
      return false;
    deps.saving.value = true;
    try {
      const res = await rollbackReport(deps.report.value.pk, version).catch(
        normalizeError
      );
      if (isSuccess(res) && res.data) {
        deps.report.value = { ...deps.report.value, ...res.data };
        deps.design.value = normalizeDesign(
          res.data.design ?? {},
          deps.dataset.value
        );
        deps.dirty.value = false;
        message(t("dataReport.versionRolledBack", { n: version }), {
          type: "success"
        });
        return true;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      return false;
    } finally {
      deps.saving.value = false;
    }
  }

  return { rollbackTo };
}
