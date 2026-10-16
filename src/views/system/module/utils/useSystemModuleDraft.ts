import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useConfirm } from "@/hooks/useConfirm";
import type { SystemModulesData } from "@/api/system/modules";
import {
  buildModulePayload,
  initModuleDraft,
  isModuleDraftDirty,
  presetModuleIds
} from "./moduleDraft";
import { moduleBaselineText, moduleSummaryText } from "./moduleTexts";

/**
 * 功能模块页草稿域（自 hook.ts 抽出）：清单派生（行/预设/概览/基线）、
 * 「预设 + 启用集合」草稿维护与脏检查；保存/恢复等动作见 hook.ts。
 */
export function useSystemModuleDraft() {
  const { t } = useI18n();
  const confirm = useConfirm();

  const data = ref<SystemModulesData | null>(null);
  /** 编辑草稿：预设 + 启用的模块 id 集合（保存前不落库） */
  const draftPreset = ref("");
  const draftEnabled = ref<Set<string>>(new Set());

  const rows = computed(() => data.value?.modules ?? []);
  const allIds = computed(() => rows.value.map(row => row.id));
  const presets = computed(() => data.value?.presets ?? []);
  const summary = computed(() => moduleSummaryText(t, data.value));
  const baselineText = computed(() => moduleBaselineText(t, data.value));

  const buildPayload = (preset: string, enabled: Set<string>) =>
    buildModulePayload({
      preset,
      enabled,
      allIds: allIds.value,
      presets: presets.value
    });

  const dirty = computed(() =>
    isModuleDraftDirty({
      data: data.value,
      draftPreset: draftPreset.value,
      draftEnabled: draftEnabled.value,
      allIds: allIds.value,
      presets: presets.value
    })
  );

  /** 用服务端数据初始化草稿（首载 / 保存 / 恢复基线后共用） */
  const initDraft = (payload: SystemModulesData) => {
    data.value = payload;
    const draft = initModuleDraft(payload);
    draftPreset.value = draft.preset;
    draftEnabled.value = draft.enabled;
  };

  const onPresetChange = async (
    value: string | number | boolean | undefined
  ) => {
    const next = String(value);
    if (next === draftPreset.value) return;
    if (dirty.value) {
      if (!(await confirm(t("systemModule.discardConfirm")))) return;
    }
    draftPreset.value = next;
    draftEnabled.value = presetModuleIds(presets.value, next);
  };

  const onToggle = (id: string, value: string | number | boolean) => {
    const next = new Set(draftEnabled.value);
    if (value) next.add(id);
    else next.delete(id);
    draftEnabled.value = next;
  };

  return {
    data,
    draftPreset,
    draftEnabled,
    rows,
    presets,
    summary,
    baselineText,
    buildPayload,
    dirty,
    initDraft,
    onPresetChange,
    onToggle
  };
}
