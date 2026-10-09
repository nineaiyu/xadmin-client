import { h } from "vue";
import { SUCCESS_CODE } from "@/api/types";
import { addDrawer } from "@/components/ReDrawer";
import { message } from "@/utils/message";
import SubmissionDetail from "../../components/SubmissionDetail.vue";
import type { FormDataItem } from "@/api/dataset/dform";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 数据详情抽屉（自 hook.tsx 抽出）：先取详情（列表契约不含 schema 快照 /
 *  审批轨迹），失败回落行数据并显式提示，不静默降级 */
export function createFormDataDetailOpener({
  t,
  retrieve
}: {
  t: TFunction;
  retrieve: (pk: string) => Promise<{
    code: number;
    data?: FormDataItem;
  } | null>;
}) {
  return async (row: FormDataItem) => {
    const res = await retrieve(row.pk).catch(() => null);
    if (res?.code !== SUCCESS_CODE) {
      // 回落列表行数据（无 schema 快照 / 审批轨迹）：显式提示，不静默降级
      message(t("dform.detailFallback"), { type: "info" });
    }
    const detail = res?.code === SUCCESS_CODE ? (res.data ?? row) : row;
    addDrawer({
      title: `${detail.form_name} - ${String(detail.pk).slice(0, 8).toUpperCase()}`,
      size: "45%",
      destroyOnClose: true,
      closeOnClickModal: true,
      hideFooter: true,
      props: { row: detail },
      contentRenderer: () => h(SubmissionDetail)
    });
  };
}
