import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { systemModuleApi } from "@/api/system/modules";
import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { useConfirm } from "@/hooks/useConfirm";
import { diffModuleDraft } from "./moduleDraft";
import type { useSystemModuleDraft } from "./useSystemModuleDraft";

/**
 * 模块配置的保存 / 恢复基线动作（自 useSystemModule 抽出，控制 hook 行数）。
 * 保存前按「预设 + 启用集合」生成可读差异并二次确认，避免误关模块。
 */
export function useModuleSave(draft: ReturnType<typeof useSystemModuleDraft>) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const saving = ref(false);

  const save = async () => {
    if (!draft.dirty.value) {
      message(t("systemModule.noChange"), { type: "info" });
      return;
    }
    const allIds = draft.rows.value.map(row => row.id);
    const diff = diffModuleDraft({
      data: draft.data.value,
      draftPreset: draft.draftPreset.value,
      draftEnabled: draft.draftEnabled.value,
      allIds
    });
    const changes = [
      diff.presetChanged
        ? t("systemModule.saveDiffPreset", {
            from: diff.from || "-",
            to: diff.to
          })
        : "",
      diff.enable.length
        ? t("systemModule.saveDiffEnable", {
            modules: diff.enable.join(", ")
          })
        : "",
      diff.disable.length
        ? t("systemModule.saveDiffDisable", {
            modules: diff.disable.join(", ")
          })
        : ""
    ].filter(Boolean);
    if (
      changes.length &&
      !(await confirm(
        t("systemModule.saveConfirm", { changes: changes.join("；") })
      ))
    ) {
      return;
    }
    saving.value = true;
    const res = await systemModuleApi
      .apply(
        draft.buildPayload(draft.draftPreset.value, draft.draftEnabled.value)
      )
      .catch(normalizeError);
    saving.value = false;
    if (!isSuccess(res) || !res.data) {
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
    if (!isSuccess(res) || !res.data) {
      message(String(res.detail ?? t("systemModule.saveFailed")), {
        type: "warning"
      });
      return;
    }
    draft.initDraft(res.data);
    message(t("systemModule.resetDone"), { type: "success" });
  };

  return { saving, save, resetToBaseline };
}
