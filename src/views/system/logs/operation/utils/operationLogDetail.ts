import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { operationLogApi } from "@/api/audit/logs/operation";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 详情抽屉全量兜底（自 hook.tsx 抽出）：列表行的 body / response_result 为
 * 有界预览（附 `*_truncated` 标记），命中标记时经 retrieve 拉全量回填，抽屉
 * 打开即为完整正文；未截断不额外请求。失败经消息出口提示并回退列表行预览
 * （返回 null 不阻断抽屉）。
 */
export async function fetchOperationLogDetail({
  t,
  row
}: {
  t: TFunction;
  row: Record<string, unknown>;
}) {
  const truncated = Boolean(
    row.body_truncated || row.response_result_truncated
  );
  const pk = row.pk;
  if (!truncated || pk == null) return null;
  try {
    const res = await operationLogApi.retrieve(pk as number | string);
    if (res.code === SUCCESS_CODE && res.data) {
      return res.data as Record<string, unknown>;
    }
    message(`${t("results.failed")}，${res.detail}`, { type: "error" });
  } catch {
    // 请求异常已由 http 拦截器统一提示，这里回退列表行预览
  }
  return null;
}
