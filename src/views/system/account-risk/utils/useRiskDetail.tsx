import { h } from "vue";
import { useI18n } from "vue-i18n";
import { ElAlert, ElDescriptions, ElDescriptionsItem } from "element-plus";
import type { RecordType } from "plus-pro-components";
import { addDrawer } from "@/components/ReDrawer";
import { METRIC_LABEL_KEYS, metricEntriesOf, metricText } from "./display";

/**
 * 账号安全风险详情抽屉（自 useAccountRisk 拆出，行为不变）：
 * 展示风险说明（description）/ 建议（suggestion）与量化指标（键名走 i18n）。
 */
export function useRiskDetail() {
  const { t } = useI18n();

  const openDetail = (row: RecordType) => {
    const detail = (row?.detail ?? {}) as RecordType;
    addDrawer({
      title: t("accountRisk.detailTitle", { name: row?.user_display || "-" }),
      size: "40%",
      destroyOnClose: true,
      hideFooter: true,
      props: { row },
      contentRenderer: () =>
        h("div", { class: "px-2" }, [
          h(ElAlert, {
            type: "info",
            closable: false,
            showIcon: true,
            title: String(detail.description ?? row?.remark ?? "-"),
            class: "mb-3"
          }),
          h(ElDescriptions, { column: 1, border: true }, () => [
            h(ElDescriptionsItem, { label: t("accountRisk.suggestion") }, () =>
              String(detail.suggestion ?? "-")
            ),
            // 量化指标逐键结构化展示（键名走 i18n，未知键回退原键）
            ...metricEntriesOf(detail).map(([key, value]) =>
              h(
                ElDescriptionsItem,
                {
                  label: METRIC_LABEL_KEYS[key]
                    ? t(METRIC_LABEL_KEYS[key])
                    : key
                },
                () => metricText(value)
              )
            )
          ])
        ])
    });
  };

  return { openDetail };
}
