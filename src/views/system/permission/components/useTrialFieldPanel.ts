import { computed, ref } from "vue";
import { message } from "@/utils/message";
import { userApi } from "@/api/identity/user";
import { buildDraftEntries, buildFieldModelOptions } from "./utils/trial";
import type { useTrialContext, TrialPanelProps } from "./useTrialContext";
import type { FieldTrialResult } from "@/api/types/permission-preview";

/**
 * 字段权限即时试算（自 useTrialPanel 抽出）：预演「该用户在某菜单下实际能看到
 * 哪些字段」（未配置=裁空），可叠加一份未保存的字段白名单草稿看新增可见字段。
 */
export function useTrialFieldPanel({
  props,
  ctx
}: {
  props: TrialPanelProps;
  ctx: ReturnType<typeof useTrialContext>;
}) {
  const { t, targetPk, menuContext, loading } = ctx;

  const fieldResult = ref<FieldTrialResult | null>(null);

  /** 字段注册表 → 模型候选（兼容 app→model→field 与 model→field 两种层级） */
  const fieldModelOptions = computed(() =>
    buildFieldModelOptions(props.fieldRuleList ?? [])
  );

  const draftFieldModel = ref("");
  const draftFieldNames = ref<string[]>([]);
  const draftFields = ref<Record<string, string[]>>({});

  const draftFieldNameOptions = computed(
    () =>
      fieldModelOptions.value.find(item => item.value === draftFieldModel.value)
        ?.fields ?? []
  );

  const draftEntries = computed(() =>
    buildDraftEntries(draftFields.value, fieldModelOptions.value)
  );

  const hasDraftFields = computed(
    () => Object.keys(draftFields.value).length > 0
  );
  const canRunField = computed(
    () => Boolean(targetPk.value && menuContext.value) && !loading.value
  );

  function addDraftFields() {
    const modelLabel = draftFieldModel.value;
    if (!modelLabel || !draftFieldNames.value.length) return;
    const current = new Set(draftFields.value[modelLabel] ?? []);
    draftFieldNames.value.forEach(name => current.add(name));
    draftFields.value = {
      ...draftFields.value,
      [modelLabel]: [...current]
    };
    draftFieldNames.value = [];
  }

  function removeDraftEntry(modelLabel: string) {
    const next = { ...draftFields.value };
    delete next[modelLabel];
    draftFields.value = next;
  }

  async function runFieldTrial() {
    if (!canRunField.value) return;
    loading.value = true;
    try {
      const res = await userApi.previewFieldTrial(targetPk.value, {
        menu: menuContext.value,
        draft: hasDraftFields.value ? { fields: draftFields.value } : null
      });
      fieldResult.value = res.data;
    } catch {
      fieldResult.value = null;
      message(t("permissionPreview.trialFailed"), { type: "error" });
    } finally {
      loading.value = false;
    }
  }

  return {
    fieldResult,
    fieldModelOptions,
    draftFieldModel,
    draftFieldNames,
    draftFieldNameOptions,
    draftEntries,
    canRunField,
    addDraftFields,
    removeDraftEntry,
    runFieldTrial
  };
}
