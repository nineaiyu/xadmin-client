import { computed, isRef, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { userApi } from "@/api/system/user";
import { hasAuth } from "@/router/utils";
import type {
  FieldTrialResult,
  TrialResult
} from "@/api/types/permission-preview";
import type { FieldLookupNode, FieldRuleRow } from "./utils/types";
import {
  buildDraftEntries,
  buildFieldModelOptions,
  buildModelOptions,
  normalizeTargetPk,
  parseBoundMenuPks,
  parseFormMode
} from "./utils/trial";

export interface TrialPanelProps {
  /** 当前表单里的规则（草稿） */
  rules?: FieldRuleRow[];
  /** 数据权限注册表树（取第二层作为试算模型候选） */
  ruleList?: FieldLookupNode[];
  /** 字段权限注册表（ROLE）树：模型 → 字段，字段试算草稿候选 */
  fieldRuleList?: FieldLookupNode[];
  /** 菜单上下文候选（绑定菜单的授权只在该上下文生效） */
  menus?: Array<{ value: string; label: string }>;
  /** 当前表单值（读 mode_type / menu 自动带入草稿，保证试算与保存同语义） */
  formValue?: unknown;
}

/**
 * 即时试算（配置页，草稿不落库）：
 * - 数据权限：把当前表单里**尚未保存**的规则 + 且/或模式 + 绑定菜单作为草稿，
 *   预演「该用户按这组规则能查到多少行」——与保存走同一套写入校验，不能绕过校验；
 * - 字段权限：预演「该用户在某菜单下实际能看到哪些字段」（未配置=裁空），
 *   可叠加一份未保存的字段白名单草稿看新增可见字段。
 */
export function useTrialPanel(props: TrialPanelProps) {
  const { t } = useI18n();

  /** 默认展开：试算入口折叠时极易被忽略 */
  const activeNames = ref<string[]>(["trial"]);

  /** 试算有独立权限码：缺失时只提示，不发必然 403 的请求 */
  const canTrial = computed(() => hasAuth("previewTrial:SystemUser"));

  const scope = ref<"data" | "field">("data");
  const targetUser = ref<object | object[] | string>();

  /* ---------- 表单上下文（草稿与保存保持同语义） ---------- */

  const formValue = computed<Record<string, unknown>>(() => {
    const raw = props.formValue;
    if (!raw) return {};
    const value = isRef(raw) ? raw.value : raw;
    return (value ?? {}) as Record<string, unknown>;
  });

  /** 表单里的且/或模式（数字/字符串/labeled 对象归一；单条规则时服务端统一按或模式保存） */
  const formMode = computed<number | null>(() =>
    parseFormMode(formValue.value.mode_type)
  );

  /** 表单绑定的菜单 pk 列表（多选；草稿只在这些菜单上下文生效） */
  const boundMenuPks = computed<string[]>(() =>
    parseBoundMenuPks(formValue.value.menu)
  );

  /* ---------- 数据权限试算 ---------- */

  const targetPk = computed(() => normalizeTargetPk(targetUser.value));

  const model = ref("");
  const menuContext = ref("");
  const loading = ref(false);
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
          rules: props.rules as unknown as Array<Record<string, unknown>>,
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

  /* ---------- 字段权限试算 ---------- */

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
    t,
    activeNames,
    canTrial,
    scope,
    targetUser,
    formMode,
    boundMenuPks,
    targetPk,
    model,
    menuContext,
    loading,
    result,
    modeOverride,
    effectiveMode,
    modeOverridden,
    modelOptions,
    canRunData,
    dataStale,
    handleModeChange,
    runDataTrial,
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
