import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 详情抽屉正文口径（LOG-P1-01）：retrieve / 导出与列表同级，body /
 * response_result 只有有界预览，不再提供全量正文出口。列表行已是详情可用的
 * 最终形态（changes 全量、正文预览 + `*_truncated` 标记），无需二次拉取。
 *
 * 保留该入口（detailRowFetch 契约）返回 null：RePlusPage 回退列表行渲染。
 */
export async function fetchOperationLogDetail({
  row: _row
}: {
  t: TFunction;
  row: Record<string, unknown>;
}) {
  return null;
}
