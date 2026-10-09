import { openDialogDrawer } from "./handle";
import DetailDataForm from "../components/DetailData.vue";
import type { useBaseColumns } from "./columns";
import type { RePlusPageProps } from "./types";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];
type BaseColumnsReturn = ReturnType<typeof useBaseColumns>;

/** 查看详情（自 usePlusPageForm.ts 抽出）：含列表行大字段的兜底回填 */
export function createDetailAction({
  props,
  t,
  detailColumns
}: {
  props: RePlusPageProps;
  t: TFunction;
  detailColumns: BaseColumnsReturn["detailColumns"];
}) {
  return async (row: Record<string, unknown>) => {
    let rawRow = { ...row };
    // 页面挂了详情兜底拉取（列表行大字段为有界预览时借详情端点回填全量）：
    // 抽屉打开前完成合并，失败由页面自行兜底（返回 null 沿用行数据），这里不再拦截
    const fetchDetailRow = props.detailRowFetch;
    if (typeof fetchDetailRow === "function") {
      const extra = await fetchDetailRow(row);
      if (extra) {
        rawRow = { ...rawRow, ...extra };
      }
    }
    openDialogDrawer({
      t,
      title: t("buttons.detail"),
      rawRow,
      rawColumns: detailColumns.value,
      dialogDrawerOptions: { width: "60vw", hideFooter: true },
      minWidth: "600px",
      formProps: { ...props.plusDescriptionsProps },
      form: DetailDataForm
    });
  };
}
