/**
 * 列表请求参数装配（纯函数，自 usePlusPageData 抽出便于单测直测）：
 * 日期区间字段拆分、pk 多选扁平化与「合并 → 深拷贝 → 扁平化」的参数构建。
 * 只做入参对象的就地变换/返回新对象，不持有 Vue 状态、不发起请求；
 * 编排流程见同目录 usePlusPageData.ts。
 */

import { cloneDeep, isArray } from "@pureadmin/utils";
import { toRaw } from "vue";

/** 需要拆分为 _after/_before 区间参数的日期字段（框架约定键名） */
const DATE_RANGE_KEYS = ["created_time", "updated_time"];

/**
 * 日期区间字段拆分：`created_time: [start, end]` → `created_time_after/_before`；
 * 非二元数组（含空值）时清空对应区间参数。
 */
export function splitDateRangeFields(fields: Record<string, unknown>): void {
  DATE_RANGE_KEYS.forEach(key => {
    const range = fields[key];
    if (isArray(range) && range.length === 2) {
      fields[`${key}_after`] = range[0];
      fields[`${key}_before`] = range[1];
    } else {
      fields[`${key}_after`] = "";
      fields[`${key}_before`] = "";
    }
  });
}

/**
 * pk 多选扁平化：`[{pk:1},{pk:2}]` / `[{id:1}]` → `[1,2]`（兼容 pk|id 两种键）；
 * 数组内无有效标识时保持原值不动。
 */
export function flattenPkCollections(params: Record<string, unknown>): void {
  Object.keys(params).forEach(key => {
    const value = params[key];
    const pks: Array<string | number> = [];
    if (isArray(value)) {
      value.forEach(rawItem => {
        const item = rawItem as {
          pk?: string | number;
          id?: string | number;
        };
        const identifier = item.pk ?? item.id;
        if (identifier) {
          pks.push(identifier);
        }
      });
      if (pks.length > 0) {
        params[key] = pks;
      }
    }
  });
}

/** 请求参数装配：合并搜索字段与调用方附加参数 → 深拷贝（脱离响应式）→ pk 扁平化 */
export function buildListParams(
  raw: Record<string, unknown>,
  queryParams: Record<string, unknown>
): Record<string, unknown> {
  const params = cloneDeep(toRaw({ ...raw, ...queryParams }));
  flattenPkCollections(params);
  return params;
}

/**
 * 「按当前搜索条件」导出时的参数装配：与列表请求同口径归一。
 *
 * 裸区间数组键后端只认 `_after/_before`（不认会被静默忽略 → 导出比列表多），
 * pk 集合要扁平化，导出端点不分页（剔 page/size）但保留 ordering。
 * 在副本上变换，**不写回 searchFields**（否则列表页查询被打脏）。
 */
export function buildExportSearchParams(
  searchFields: Record<string, unknown>,
  type: unknown
): Record<string, unknown> {
  const draft: Record<string, unknown> = {
    ...toRaw(searchFields),
    type
  };
  splitDateRangeFields(draft);
  const { page: _page, size: _size, ...rest } = draft;
  return buildListParams(rest, {});
}

/**
 * 「导出选中行」的范围收敛：拿到 `spm`（范围令牌）才允许导出，并去掉一次性 pks。
 *
 * spm 缺失 = 范围条件整体丢失，退化成全量导出会把「选中」静默放大为「全部」，
 * 故缺 spm 时返回 ok=false 且**不动 formData**（pks 保留供重试）。
 */
export function applySelectedExportScope(
  formData: Record<string, unknown>,
  spm: string | undefined
): { ok: boolean; params: Record<string, unknown> } {
  if (!spm) return { ok: false, params: formData };
  const params: Record<string, unknown> = { ...formData, spm };
  delete params.pks;
  return { ok: true, params };
}
