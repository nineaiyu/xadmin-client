/**
 * 表单数据（管理端）选人字段辅助（纯函数，自 useFormData 抽出便于单测直测）：
 * 展示名拼装与用户主键收集。不持有 Vue 状态、不发起请求。
 */

import type {
  FormDataItem,
  FormField,
  FormUserOption
} from "@/api/dataset/dform";

/** 选人展示名：有昵称则 username-nickname，否则 username（筛选回显与列表回显同口径） */
export const userLabelText = (user: FormUserOption) =>
  user.nickname ? `${user.username}-${user.nickname}` : user.username;

/**
 * 收集行数据中选人字段引用的用户 pk（数组多选展开；仅正整数主键入集，去重保序）。
 */
export function collectUserPks(
  rows: FormDataItem[],
  fields: FormField[]
): number[] {
  const pks = new Set<number>();
  for (const field of fields) {
    if (field.type !== "user") continue;
    for (const row of rows) {
      const raw = row.data?.[field.key];
      for (const item of Array.isArray(raw) ? raw : [raw]) {
        const pk = Number(item);
        if (Number.isInteger(pk) && pk > 0) pks.add(pk);
      }
    }
  }
  return [...pks];
}
