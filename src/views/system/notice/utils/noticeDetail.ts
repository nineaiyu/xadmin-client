import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import type { RecordType } from "plus-pro-components";
import type { noticeApi } from "@/api/system/notice";

/** 详情前取一次原文：行快照可能不含最新正文；失败回退行快照 */
export function createNoticeDetailFetch(
  api: Pick<typeof noticeApi, "retrieve">
) {
  return async (row: RecordType) => {
    const res = await api.retrieve(row.pk as string).catch(normalizeError);
    return isSuccess(res) && res.data ? { ...row, ...res.data } : null;
  };
}
