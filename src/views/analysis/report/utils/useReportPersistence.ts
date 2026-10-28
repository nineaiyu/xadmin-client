import { ref, type ComputedRef, type Ref } from "vue";
import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import type { DatasetItem } from "@/api/dataset/datasets";
import {
  reportApi,
  runReport,
  type ReportDesign,
  type ReportDesignComponent,
  type ReportItem
} from "@/api/dataset/analysis";
import { normalizeDesign } from "./design";
import { normalizeError } from "@/utils/apiError";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 报表设计器的落库动作（自 designer.vue 抽出，行数门禁）：保存与「立即运行」。
 *
 * 保存走 `partialUpdate({design})`，本地先 `normalizeDesign` 收敛，服务端再校验
 * 一次；空 design = 存量口径（全列明细单表），编辑器清空组件与列即回到该口径。
 * 「立即运行」按**已保存**的设计投递执行，有未保存改动时先提示保存。
 */
export function useReportPersistence(deps: {
  t: TFunction;
  report: Ref<ReportItem | null>;
  dataset: Ref<DatasetItem | null>;
  design: Ref<ReportDesign>;
  saving: Ref<boolean>;
  dirty: Ref<boolean>;
  readonly: ComputedRef<boolean>;
  datasetMissing: Ref<boolean>;
  /** 明细列（空 = 全部列）：保存前校验至少一列 */
  columns: ComputedRef<unknown[]>;
  components: ComputedRef<ReportDesignComponent[]>;
}) {
  const { t } = deps;

  async function save() {
    if (
      !deps.report.value ||
      deps.saving.value ||
      deps.readonly.value ||
      deps.datasetMissing.value
    )
      return;
    if (deps.columns.value.length === 0) {
      message(t("dataReport.columnsRequired"), { type: "warning" });
      return;
    }
    const missingGroup = deps.components.value.find(
      item => item.type !== "number" && !item.group_by
    );
    if (missingGroup) {
      message(t("dataReport.groupByRequired"), { type: "warning" });
      return;
    }
    deps.saving.value = true;
    try {
      const payload = normalizeDesign(deps.design.value, deps.dataset.value);
      // 乐观锁基线：把本次看到的设计版本原样回传，他人先保存时后端拒绝后写覆盖
      const baseVersion = deps.report.value.design_version;
      const res = await reportApi
        .partialUpdate<ReportItem>(deps.report.value.pk, {
          design: payload,
          ...(baseVersion !== undefined ? { base_version: baseVersion } : {})
        })
        .catch(normalizeError);
      if (isSuccess(res)) {
        deps.design.value = payload;
        deps.dirty.value = false;
        if (res.data) deps.report.value = { ...deps.report.value, ...res.data };
        message(t("dataReport.designSaved"), { type: "success" });
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
    } finally {
      deps.saving.value = false;
    }
  }

  /** 立即运行：按已保存的设计投递执行（未保存改动先提示，避免产出与所见不一致） */
  const running = ref(false);
  async function runNow() {
    if (
      !deps.report.value ||
      running.value ||
      deps.readonly.value ||
      deps.datasetMissing.value
    )
      return;
    if (deps.dirty.value) {
      message(t("dataReport.runDirty"), { type: "warning" });
      return;
    }
    running.value = true;
    try {
      const res = await runReport(deps.report.value.pk).catch(normalizeError);
      if (isSuccess(res)) {
        message(t("dataReport.runOk"), { type: "success" });
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
    } finally {
      running.value = false;
    }
  }

  return { save, running, runNow };
}
