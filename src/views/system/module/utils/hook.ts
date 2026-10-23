import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { systemModuleApi } from "@/api/system/modules";
import { isSuccess } from "@/api/types";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { copyText as copyTextWithFeedback } from "@/utils/clipboard";
import { moduleLevelKey, moduleLevelTagType } from "./moduleDraft";
import { useModuleSave } from "./useModuleSave";
import { useSystemModuleDraft } from "./useSystemModuleDraft";

/**
 * 功能模块页逻辑：加载模块清单 → 维护「预设 + 启用集合」草稿 → 保存/恢复基线
 * → 复制命令。草稿派生与脏检查见 useSystemModuleDraft.ts，保存动作见
 * useModuleSave.ts，纯函数见 moduleDraft.ts。
 */
export function useSystemModule() {
  const { t } = useI18n();

  const loading = ref(true);
  const loadError = ref(false);
  const draft = useSystemModuleDraft();
  const { saving, save, resetToBaseline } = useModuleSave(draft);

  const canApply = hasAuth("apply:SystemModule");
  const canReset = hasAuth("reset:SystemModule");

  const load = async () => {
    loading.value = true;
    loadError.value = false;
    // 统一归一异常：业务码非 1000（如无权限 403 归一）也要给出可读提示
    const res = await systemModuleApi.list().catch(normalizeError);
    loading.value = false;
    if (!isSuccess(res) || !res.data) {
      loadError.value = true;
      message(String(res.detail ?? t("systemModule.loadFailed")), {
        type: "warning"
      });
      return;
    }
    draft.initDraft(res.data);
  };

  /** 复制文本到剪贴板并统一提示（空值不动作） */
  const copyText = async (text: string) => {
    if (text) await copyTextWithFeedback(text);
  };

  onMounted(load);

  return {
    t,
    loading,
    loadError,
    saving,
    data: draft.data,
    draftPreset: draft.draftPreset,
    draftEnabled: draft.draftEnabled,
    moduleLevelKey,
    moduleLevelTagType,
    canApply,
    canReset,
    presets: draft.presets,
    rows: draft.rows,
    summary: draft.summary,
    baselineText: draft.baselineText,
    onPresetChange: draft.onPresetChange,
    onToggle: draft.onToggle,
    save,
    resetToBaseline,
    copyText,
    load
  };
}
