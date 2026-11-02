import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
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
        cancelButtonText: t("buttons.cancel"),
        danger: true
      }))
    ) {
      return;
    }
    const res = await api
      .destroy(row.pk as string | number)
      .catch(normalizeError);
    if (isSuccess(res)) {
      message(t("results.success"), { type: "success" });
      tableRef.value?.handleGetData();
      return;
    }
    // 请求失败（normalizeError → code -1）已由 http 层统一提示，不重复弹窗；
    // 仅 HTTP 200 + 业务码失败需要页面显式提示
    if (res.code !== -1 && res.detail) {
      message(t("results.failedWithDetail", { detail: res.detail }), {
        type: "error"
      });
    }
  };
}
