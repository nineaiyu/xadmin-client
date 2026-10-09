import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { systemModuleApi } from "@/api/system/modules";
import { SUCCESS_CODE } from "@/api/types";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { copyText as copyTextWithFeedback } from "@/utils/clipboard";
import { useConfirm } from "@/hooks/useConfirm";
import { MODULE_LEVEL_KEY, MODULE_LEVEL_TAG_TYPE } from "./moduleDraft";
import { useSystemModuleDraft } from "./useSystemModuleDraft";

/**
 * 功能模块页逻辑：加载模块清单 → 维护「预设 + 启用集合」草稿 → 保存/恢复基线
 * → 复制命令。草稿派生与脏检查见 useSystemModuleDraft.ts，纯函数见 moduleDraft.ts。
 */
export function useSystemModule() {
  const { t } = useI18n();
  const confirm = useConfirm();

  const loading = ref(true);
  const saving = ref(false);
  const draft = useSystemModuleDraft();

  const canApply = hasAuth("apply:SystemModule");
  const canReset = hasAuth("reset:SystemModule");

  const load = async () => {
    loading.value = true;
    // 统一归一异常：业务码非 1000（如无权限 403 归一）也要给出可读提示
    const res = await systemModuleApi.list().catch(normalizeError);
    loading.value = false;
    if (res.code !== SUCCESS_CODE || !res.data) {
      message(String(res.detail ?? t("systemModule.loadFailed")), {
        type: "warning"
      });
      return;
    }
    draft.initDraft(res.data);
  };

  const save = async () => {
    if (!draft.dirty.value) {
      message(t("systemModule.noChange"), { type: "info" });
      return;
    }
    saving.value = true;
    const res = await systemModuleApi
      .apply(
        draft.buildPayload(draft.draftPreset.value, draft.draftEnabled.value)
      )
      .catch(normalizeError);
    saving.value = false;
    if (res.code !== SUCCESS_CODE || !res.data) {
      message(String(res.detail ?? t("systemModule.saveFailed")), {
        type: "warning"
      });
      return;
    }
    draft.initDraft(res.data);
    message(t("systemModule.saved"), { type: "success" });
  };

  const resetToBaseline = async () => {
    if (!(await confirm(t("systemModule.resetConfirm")))) return;
    saving.value = true;
    const res = await systemModuleApi.reset().catch(normalizeError);
    saving.value = false;
    if (res.code !== SUCCESS_CODE || !res.data) {
      message(String(res.detail ?? t("systemModule.saveFailed")), {
        type: "warning"
      });
      return;
    }
    draft.initDraft(res.data);
    message(t("systemModule.resetDone"), { type: "success" });
  };

  /** 复制文本到剪贴板并统一提示（空值不动作） */
  const copyText = async (text: string) => {
    if (text) await copyTextWithFeedback(text);
  };

  onMounted(load);

  return {
    t,
    loading,
    saving,
    data: draft.data,
    draftPreset: draft.draftPreset,
    draftEnabled: draft.draftEnabled,
    LEVEL_TAG_TYPE: MODULE_LEVEL_TAG_TYPE,
    LEVEL_KEY: MODULE_LEVEL_KEY,
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
    copyText
  };
}
