import { computed, ref } from "vue";
import { message } from "@/utils/message";
import { userApi } from "@/api/system/user";
import { buildModelOptions } from "./utils/trial";
import type { useTrialContext, TrialPanelProps } from "./useTrialContext";
import type { TrialResult } from "@/api/types/permission-preview";

/**
 * 数据权限即时试算（自 useTrialPanel 抽出）：把当前表单里**尚未保存**的规则 +
 * 且/或模式 + 绑定菜单作为草稿，预演「该用户按这组规则能查到多少行」——
 * 与保存走同一套写入校验，不能绕过校验。
 */
export function useTrialDataPanel({
  props,
  ctx
}: {
  props: TrialPanelProps;
  ctx: ReturnType<typeof useTrialContext>;
}) {
  const { t, targetPk, formMode, boundMenuPks, menuContext, loading } = ctx;

  const model = ref("");
  const result = ref<TrialResult | null>(null);

  /** 试算模式：默认跟随表单，可手动覆盖 */
  const modeOverride = ref<number | null>(null);
  const effectiveMode = computed(
    () => modeOverride.value ?? formMode.value ?? 0
  );
  const modeOverridden = computed(
    () => modeOverride.value !== null && modeOverride.value !== formMode.value
  );

  /** 模型候选 = 注册表树第二层（app → model → field） */
  const modelOptions = computed(() => buildModelOptions(props.ruleList ?? []));

  const canRunData = computed(
    () =>
      Boolean(targetPk.value && model.value && props.rules?.length) &&
      !loading.value
  );

  /** 结果与当前草稿是否一致（规则/模式/绑定菜单变化后提示重新试算） */
  const lastRunKey = ref("");
  const draftKey = computed(() =>
    JSON.stringify({
      rules: props.rules,
      mode: effectiveMode.value,
      menu: boundMenuPks.value
    })
  );
  const dataStale = computed(
    () => Boolean(result.value) && lastRunKey.value !== draftKey.value
  );

  function handleModeChange(value: number) {
    // 与表单一致时回到「跟随」状态，避免留下无意义的覆盖标记
    modeOverride.value = value === formMode.value ? null : value;
  }

  async function runDataTrial() {
    if (!canRunData.value) return;
    loading.value = true;
    try {
      const res = await userApi.previewTrial(targetPk.value, {
        model: model.value,
        menu: menuContext.value ? menuContext.value : null,
        draft: {
          rules: props.rules,
          mode_type: effectiveMode.value,
          // 表单绑定的菜单一并带入：草稿只在对应上下文生效（与保存后一致）
          menu: boundMenuPks.value.length ? boundMenuPks.value : null
        }
      });
      result.value = res.data;
      lastRunKey.value = draftKey.value;
    } catch {
      result.value = null;
      message(t("permissionPreview.trialFailed"), { type: "error" });
    } finally {
      loading.value = false;
    }
  }

  return {
    model,
    result,
    modeOverride,
    effectiveMode,
    modeOverridden,
    modelOptions,
    canRunData,
    dataStale,
    handleModeChange,
    runDataTrial
  };
}
