import type { useI18n } from "vue-i18n";
import { operationLogApi } from "@/api/audit/logs/operation";
import { isSuccess } from "@/api/types";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 详情抽屉口径：列表的 changes 已降为有界预览，详情必须按主键
 * 重新调用 retrieve 取全量变更对照；正文仍按服务端的同级有界预览输出。
 * 拉取失败返回 null，RePlusPage 回退列表行，不阻断抽屉打开。
 */
export async function fetchOperationLogDetail({
  row
}: {
  t: TFunction;
  row: Record<string, unknown>;
}) {
  const pk = row.pk;
  if (pk === undefined || pk === null || pk === "") return null;
  try {
    const res = await operationLogApi.retrieve(String(pk));
    return isSuccess(res) ? (res.data ?? null) : null;
  } catch {
    return null;
  }
}
