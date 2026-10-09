import type { useI18n } from "vue-i18n";
import type { SystemModulesData } from "@/api/system/modules";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 启用概览文案（自 hook.ts 抽出）：`已启用 N / 共 M` */
export function moduleSummaryText(
  t: TFunction,
  data: SystemModulesData | null
): string {
  return data
    ? t("systemModule.enabledSummary", {
        enabled: data.enabled_count,
        total: data.total
      })
    : "";
}

/** 基线文案（自 hook.ts 抽出）：预设 + 增删项（空集合显示「无」） */
export function moduleBaselineText(
  t: TFunction,
  data: SystemModulesData | null
): string {
  const baseline = data?.baseline;
  if (!baseline) return "";
  const none = t("systemModule.baselineEmpty");
  return t("systemModule.baselineValue", {
    preset: baseline.preset,
    enable: baseline.enable.length ? baseline.enable.join(", ") : none,
    disable: baseline.disable.length ? baseline.disable.join(", ") : none
  });
}
