import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";

import {
  systemModuleApi,
  type ModuleLevel,
  type SystemModuleApplyPayload,
  type SystemModulesData
} from "@/api/system/modules";
import { SUCCESS_CODE } from "@/api/types";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";

/**
 * 功能模块页逻辑（页面唯一无 hook 的历史遗留补齐）：
 * 加载模块清单 → 维护「预设 + 启用集合」草稿 → 保存/恢复基线 → 复制命令。
 */
export function useSystemModule() {
  const { t } = useI18n();

  const loading = ref(true);
  const saving = ref(false);
  const data = ref<SystemModulesData | null>(null);

  /** 编辑草稿：预设 + 启用的模块 id 集合（保存前不落库） */
  const draftPreset = ref("");
  const draftEnabled = ref<Set<string>>(new Set());

  /** 等级 → 标签色（内核不可裁 / 标配默认开 / 可选按需开） */
  const LEVEL_TAG_TYPE: Record<ModuleLevel, "info" | "success" | "warning"> = {
    core: "info",
    standard: "success",
    optional: "warning"
  };
  const LEVEL_KEY: Record<ModuleLevel, string> = {
    core: "levelCore",
    standard: "levelStandard",
    optional: "levelOptional"
  };

  const canApply = hasAuth("apply:SystemModule");
  const canReset = hasAuth("reset:SystemModule");

  const rows = computed(() => data.value?.modules ?? []);
  const allIds = computed(() => rows.value.map(row => row.id));
  const presets = computed(() => data.value?.presets ?? []);
  const summary = computed(() => {
    const item = data.value;
    return item
      ? t("systemModule.enabledSummary", {
          enabled: item.enabled_count,
          total: item.total
        })
      : "";
  });
  const baselineText = computed(() => {
    const baseline = data.value?.baseline;
    if (!baseline) return "";
    const none = t("systemModule.baselineEmpty");
    return t("systemModule.baselineValue", {
      preset: baseline.preset,
      enable: baseline.enable.length ? baseline.enable.join(", ") : none,
      disable: baseline.disable.length ? baseline.disable.join(", ") : none
    });
  });

  const presetIds = (preset: string) =>
    new Set(
      presets.value.find(item => item.value === preset)?.module_ids ?? []
    );

  /** 把「预设 + 启用集合」反推为 config.yml 同语义的增删项 */
  const buildPayload = (
    preset: string,
    enabled: Set<string>
  ): SystemModuleApplyPayload => {
    const defaults = presetIds(preset);
    return {
      preset,
      enable: allIds.value
        .filter(id => enabled.has(id) && !defaults.has(id))
        .sort(),
      disable: allIds.value
        .filter(id => defaults.has(id) && !enabled.has(id))
        .sort()
    };
  };

  const desiredEnabled = computed(() => {
    const disabled = new Set(data.value?.desired.disabled ?? []);
    return new Set(allIds.value.filter(id => !disabled.has(id)));
  });

  const dirty = computed(() => {
    if (!data.value) return false;
    const current = buildPayload(
      data.value.desired.preset,
      desiredEnabled.value
    );
    const draft = buildPayload(draftPreset.value, draftEnabled.value);
    return JSON.stringify(current) !== JSON.stringify(draft);
  });

  const initDraft = (payload: SystemModulesData) => {
    data.value = payload;
    draftPreset.value = payload.desired.preset;
    const disabled = new Set(payload.desired.disabled);
    draftEnabled.value = new Set(
      payload.modules.map(row => row.id).filter(id => !disabled.has(id))
    );
  };

  const normalizeError = (error: unknown) => ({
    code: -1,
    detail: String((error as { detail?: string })?.detail ?? error),
    data: null
  });

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
    initDraft(res.data);
  };

  const onPresetChange = async (
    value: string | number | boolean | undefined
  ) => {
    const next = String(value);
    if (next === draftPreset.value) return;
    if (dirty.value) {
      try {
        await ElMessageBox.confirm(t("systemModule.discardConfirm"), {
          type: "warning"
        });
      } catch {
        return;
      }
    }
    draftPreset.value = next;
    draftEnabled.value = new Set(presetIds(next));
  };

  const onToggle = (id: string, value: string | number | boolean) => {
    const next = new Set(draftEnabled.value);
    if (value) next.add(id);
    else next.delete(id);
    draftEnabled.value = next;
  };

  const save = async () => {
    if (!dirty.value) {
      message(t("systemModule.noChange"), { type: "info" });
      return;
    }
    saving.value = true;
    const res = await systemModuleApi
      .apply(buildPayload(draftPreset.value, draftEnabled.value))
      .catch(normalizeError);
    saving.value = false;
    if (res.code !== SUCCESS_CODE || !res.data) {
      message(String(res.detail ?? t("systemModule.saveFailed")), {
        type: "warning"
      });
      return;
    }
    initDraft(res.data);
    message(t("systemModule.saved"), { type: "success" });
  };

  const resetToBaseline = async () => {
    try {
      await ElMessageBox.confirm(t("systemModule.resetConfirm"), {
        type: "warning"
      });
    } catch {
      return;
    }
    saving.value = true;
    const res = await systemModuleApi.reset().catch(normalizeError);
    saving.value = false;
    if (res.code !== SUCCESS_CODE || !res.data) {
      message(String(res.detail ?? t("systemModule.saveFailed")), {
        type: "warning"
      });
      return;
    }
    initDraft(res.data);
    message(t("systemModule.resetDone"), { type: "success" });
  };

  const copyText = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      message(t("systemModule.copied"), { type: "success" });
    } catch {
      message(t("systemModule.copyFailed"), { type: "warning" });
    }
  };

  onMounted(load);

  return {
    t,
    loading,
    saving,
    data,
    draftPreset,
    draftEnabled,
    LEVEL_TAG_TYPE,
    LEVEL_KEY,
    canApply,
    canReset,
    presets,
    rows,
    summary,
    baselineText,
    onPresetChange,
    onToggle,
    save,
    resetToBaseline,
    copyText
  };
}
