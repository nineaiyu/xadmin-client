import { ref, type Ref } from "vue";
import { isSuccess } from "@/api/types";
import { systemCodeGenApi } from "@/api/system/codegen";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import type { useI18n } from "vue-i18n";
import {
  importPlan,
  listPlans,
  removePlan,
  savePlan,
  type SavedPlan
} from "./plan-service";
import { normalizeFormState, type CodegenFormState } from "./payload";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 生成方案的加载 / 保存 / 重命名 / 删除 / 导入（服务端存储）。 */
export function useCodegenPlans({
  t,
  state,
  pendingPlanState,
  planError,
  loadPlan
}: {
  t: TFunction;
  state: CodegenFormState;
  pendingPlanState: Ref<CodegenFormState | null>;
  /** 模型计划装载错误：载入方案后按结果决定提示成功还是失败 */
  planError: Ref<string>;
  loadPlan: (label: string) => Promise<void>;
}) {
  const savedPlans = ref<SavedPlan[]>([]);

  /** 方案操作失败提示：统一带服务端 detail，避免各 catch 重复拼装 */
  const notifyFailure = (key: string, error: unknown) =>
    message(`${t(key)}：${normalizeError(error).detail}`, { type: "error" });

  async function refreshPlans() {
    savedPlans.value = await listPlans();
  }

  async function onSavePlan(name: string, isShared: boolean) {
    try {
      savedPlans.value = await savePlan(
        name,
        { ...state, fields: [...state.fields] },
        isShared
      );
      message(t("codegen.planSaved"), { type: "success" });
    } catch (error) {
      notifyFailure("codegen.planSaveFailed", error);
    }
  }

  async function onLoadPlan(plan: SavedPlan) {
    const restored = normalizeFormState(plan.state);
    pendingPlanState.value = restored;
    Object.assign(state, restored);
    state.fields = [...restored.fields];
    if (state.model) {
      await loadPlan(state.model);
      // 字段计划装载失败时不能先报「方案已载入」：文案要与实际结果一致
      if (planError.value) {
        message(planError.value, { type: "error" });
        return;
      }
    }
    message(t("codegen.planLoaded"), { type: "success" });
  }

  async function onUpdatePlan(
    pk: string,
    patch: { name?: string; is_shared?: boolean }
  ) {
    try {
      const res = await systemCodeGenApi.planUpdate(pk, patch);
      if (!res || !isSuccess(res)) {
        throw new Error(
          String(res?.detail ?? t("codegen.planOperationFailed"))
        );
      }
      await refreshPlans();
      message(t("codegen.planUpdated"), { type: "success" });
    } catch (error) {
      notifyFailure("codegen.planUpdateFailed", error);
    }
  }

  async function onRemovePlan(pk: string) {
    try {
      savedPlans.value = await removePlan(pk);
      message(t("codegen.planDeleted"), { type: "success" });
    } catch (error) {
      notifyFailure("codegen.planDeleteFailed", error);
    }
  }

  async function onImportPlans(json: string) {
    try {
      await importPlan(json);
      await refreshPlans();
      message(t("codegen.planImported"), { type: "success" });
    } catch (error) {
      notifyFailure("codegen.planImportFailed", error);
    }
  }

  return {
    savedPlans,
    refreshPlans,
    onSavePlan,
    onLoadPlan,
    onUpdatePlan,
    onRemovePlan,
    onImportPlans
  };
}
