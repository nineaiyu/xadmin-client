import type { ComputedRef, Ref } from "vue";
import { isSuccess } from "@/api/types";
import {
  systemCodeGenApi,
  type CodegenArtifact,
  type CodegenModelPlan
} from "@/api/system/codegen";
import { normalizeError } from "@/utils/apiError";
import type { useI18n } from "vue-i18n";
import type { CodegenFormState } from "./payload";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 模型字段计划装载：切换模型清场、载入方案回填、失败/提前返回时清理待应用方案。
 * 从页面壳拆出以控制单文件行数；状态仍由页面持有（方案载入与字段表共用）。
 */
export function useCodegenPlanLoader({
  t,
  state,
  planData,
  planLoading,
  planError,
  artifacts,
  hasPreviewed,
  pendingPlanState,
  baselineSignature,
  payloadSignature,
  canLoadFields,
  fieldTableRef
}: {
  t: TFunction;
  state: CodegenFormState;
  planData: Ref<CodegenModelPlan | null>;
  planLoading: Ref<boolean>;
  planError: Ref<string>;
  artifacts: Ref<CodegenArtifact[]>;
  hasPreviewed: Ref<boolean>;
  pendingPlanState: Ref<CodegenFormState | null>;
  baselineSignature: Ref<string>;
  payloadSignature: ComputedRef<string>;
  canLoadFields: boolean;
  fieldTableRef: Ref<
    { rebuild?: (plan: CodegenModelPlan) => void } | undefined
  >;
}) {
  async function loadPlan(label: string) {
    // 切换模型先清场：请求失败时不再残留上一个模型的字段表与产物
    planData.value = null;
    state.fields = [];
    artifacts.value = [];
    hasPreviewed.value = false;
    // 待应用方案只对载入时的模型有效；模型切走或加载失败即丢弃，避免把旧方案
    // 字段按同名过滤后注入新模型。
    if (pendingPlanState.value && pendingPlanState.value.model !== label) {
      pendingPlanState.value = null;
    }
    if (!label) {
      pendingPlanState.value = null;
      return;
    }
    // 先落基线：无字段权限或计划请求失败时不应把「刚选完模型」判成未保存改动
    baselineSignature.value = payloadSignature.value;
    if (!canLoadFields) {
      pendingPlanState.value = null;
      return;
    }
    planLoading.value = true;
    planError.value = "";
    try {
      const res = await systemCodeGenApi.modelFields(label).catch(error => {
        planError.value = normalizeError(error).detail || t("results.failed");
        return null;
      });
      if (!res) {
        pendingPlanState.value = null;
        return;
      }
      if (!isSuccess(res) || !res.data) {
        planError.value = String(res.detail ?? t("results.failed"));
        pendingPlanState.value = null;
        return;
      }
      planData.value = res.data;
      if (pendingPlanState.value) {
        // 载入保存方案：命名与字段配置以方案为准（仅保留当前模型仍存在的字段）
        const saved = pendingPlanState.value;
        pendingPlanState.value = null;
        state.fields = saved.fields.filter(field =>
          (res.data?.fields ?? []).some(item => item.name === field.name)
        );
      } else {
        state.component = res.data.defaults.component;
        state.url_prefix = res.data.defaults.url_prefix;
        state.frontend_dir = res.data.defaults.frontend_dir;
        fieldTableRef.value?.rebuild?.(res.data);
      }
      // 模型计划装配完成即基线：后续字段/命名改动才触发离开确认
      baselineSignature.value = payloadSignature.value;
    } finally {
      planLoading.value = false;
    }
  }

  return { loadPlan };
}
