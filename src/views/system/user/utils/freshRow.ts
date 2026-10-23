import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import type { RecordType } from "plus-pro-components";

type DetailApi = {
  detail: (
    pk: string | number
  ) => Promise<{ code?: number; data?: RecordType | null; detail?: string }>;
};

/**
 * 行快照 → 详情合并：管理抽屉 / 授权弹窗打开前取一次最新详情，
 * 失败（无 retrieve 权限 / 网络异常）回退行快照，不阻断入口。
 */
export async function fetchFreshRow(
  api: DetailApi,
  row: RecordType
): Promise<RecordType> {
  const res = await api.detail(row.pk as string).catch(normalizeError);
  return (
    isSuccess(res) && res.data ? { ...row, ...res.data } : row
  ) as RecordType;
}
