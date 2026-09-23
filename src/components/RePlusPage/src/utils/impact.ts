/**
 * 删除前影响面预检（F-2）。
 *
 * 删除/批量删除前调用 `POST {baseApi}/impact`（仅混入 ImpactPreviewAction 的视图集
 * 提供该路由）：有引用时弹窗展示「会影响谁」（引用方计数 + 样本 + 处置建议），
 * 用户确认后调用方带 `impact_confirmed=true` 重发删除请求（后端引用保护开关打开时
 * fail-closed 要求显式确认；未打开时该参数无副作用）。
 *
 * 容错：未提供 impact 端点的资源（404/405）或预检异常一律放行（不阻断既有删除），
 * 并按 baseApi 记忆，避免每次删除都多发一次无效请求。
 */

import { h } from "vue";
import { ElMessageBox } from "element-plus";
import type { BaseApi } from "@/api/base";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

export interface ImpactItem {
  key: string;
  label: string;
  count: number;
  hint?: string;
  samples?: string[];
}

interface ImpactResult {
  pk: string;
  model: string;
  name: string;
  has_impact: boolean;
  items: ImpactItem[];
  suggestions?: string[];
}

export interface ImpactPayload {
  results: ImpactResult[];
  totals: ImpactItem[];
  has_impact: boolean;
  guarded?: boolean;
}

/**
 * 支持影响面预检的资源（与后端对齐的单一清单）：
 * 后端 `system/utils/impact.py::IMPACT_CALCULATORS` + `ImpactPreviewAction` 混入
 * 的 8 个视图集一一对应（`tests/unit/system/test_impact_api.py` 守护后端两侧一致）。
 *
 * 为什么用白名单而不是「探测」：未混入 ImpactPreviewAction 的视图集（如用户）
 * POST `{baseApi}/impact` 会命中 detail 路由返回 405，http 层会弹全局错误提示
 * （污染正常交互）；白名单让非支持资源零请求、零噪音。
 */
const IMPACT_SUPPORTED = new Set([
  "/api/system/role",
  "/api/system/dept",
  "/api/system/dict",
  "/api/system/datasets",
  "/api/system/approval-flows",
  "/api/system/dynamic-forms",
  "/api/system/screens",
  "/api/system/menu"
]);

/** 运行期探测失败的资源（404/405 后不再请求，兜底防御） */
const unsupported = new Set<string>();

/** 测试辅助：重置「不支持」记忆 */
export function resetImpactSupportCache() {
  unsupported.clear();
}

function renderImpact(data: ImpactPayload, t: TFunction) {
  const blocks = data.results
    .filter(result => result.has_impact)
    .slice(0, 5)
    .map(result =>
      h("div", { class: "mb-2" }, [
        h("div", { class: "font-medium" }, `${result.name || result.pk}`),
        ...result.items.map(item =>
          h(
            "div",
            { class: "pl-2 text-sm text-[var(--el-text-color-secondary)]" },
            [
              `${item.label}：${item.count}`,
              item.samples?.length ? `（${item.samples.join("、")}）` : ""
            ]
          )
        )
      ])
    );
  // 处置建议来自逐对象明细（后端 result 级），去重后合并展示
  const suggestions = Array.from(
    new Set(data.results.flatMap(result => result.suggestions ?? []))
  );
  const tips = suggestions.length
    ? h("div", { class: "mt-2 text-sm" }, suggestions.join("；"))
    : null;
  return h("div", [
    h("div", { class: "mb-2" }, t("impact.affected")),
    ...blocks,
    ...(tips ? [tips] : [])
  ]);
}

async function showImpactConfirm(
  data: ImpactPayload,
  t: TFunction
): Promise<boolean> {
  try {
    await ElMessageBox.confirm(renderImpact(data, t), t("impact.title"), {
      confirmButtonText: t("impact.confirmDelete"),
      cancelButtonText: t("buttons.cancel"),
      type: "warning"
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 影响面预检：返回 true = 继续删除（无影响 / 用户确认 / 资源不支持预检）。
 */
export async function confirmImpact(
  api: BaseApi,
  pks: Array<string | number>,
  t: TFunction
): Promise<boolean> {
  const baseApi = api?.baseApi;
  if (!baseApi || !pks.length) return true;
  if (!IMPACT_SUPPORTED.has(baseApi) || unsupported.has(baseApi)) return true;
  let data: ImpactPayload | undefined;
  try {
    const res = await api.request<{ data?: ImpactPayload }>(
      "post",
      {},
      { pks },
      `${baseApi}/impact`
    );
    data = res?.data;
  } catch {
    unsupported.add(baseApi);
    return true;
  }
  if (!data?.has_impact) return true;
  return showImpactConfirm(data, t);
}
