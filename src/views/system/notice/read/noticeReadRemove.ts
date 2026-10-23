import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import type { noticeReadApi } from "@/api/system/notice";
import { message } from "@/utils/message";
import { useConfirm } from "@/hooks/useConfirm";
import type { NoticeReadRow } from "./noticeReadRules";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 公告族「移除」动作（自 hook 抽出，控制 hook 行数） */
export function createNoticeReadRemove({
  t,
  api,
  tableRef
}: {
  t: TFunction;
  api: Pick<typeof noticeReadApi, "destroy">;
  tableRef: Ref;
}) {
  const confirm = useConfirm();
  return async (row: NoticeReadRow) => {
    if (
      !(await confirm(t("noticeRead.removeConfirm"), {
        title: t("noticeRead.remove"),
        type: "warning",
        confirmButtonText: t("buttons.confirm"),
        cancelButtonText: t("buttons.cancel")
      }))
    ) {
      return;
    }
    try {
      const res = await api.destroy(row.pk as string | number);
      if (isSuccess(res)) {
        message(t("results.success"), { type: "success" });
        tableRef.value?.handleGetData();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    } catch (error) {
      message(
        `${t("results.failed")}，${(error as { message?: string })?.message ?? ""}`,
        { type: "error" }
      );
    }
  };
}
