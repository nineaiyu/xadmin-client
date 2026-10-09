import { computed, isRef, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import {
  normalizeTargetPk,
  parseBoundMenuPks,
  parseFormMode
} from "./utils/trial";
import type { FieldLookupNode, FieldRuleRow } from "./utils/types";

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
 * 即时试算的共享上下文（自 useTrialPanel 抽出）：折叠态 / 试算权限 / 作用域 /
 * 目标用户 / 表单草稿上下文（模式与绑定菜单）/ 试算请求 loading。
 * 数据权限与字段权限各自的试算状态见 useTrialDataPanel / useTrialFieldPanel。
 */
export function useTrialContext(props: TrialPanelProps) {
  const { t } = useI18n();

  /** 默认展开：试算入口折叠时极易被忽略 */
  const activeNames = ref<string[]>(["trial"]);

  /** 试算有独立权限码：缺失时只提示，不发必然 403 的请求 */
  const canTrial = computed(() => hasAuth("previewTrial:SystemUser"));

  const scope = ref<"data" | "field">("data");
  const targetUser = ref<object | object[] | string>();

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

  const targetPk = computed(() => normalizeTargetPk(targetUser.value));

  const menuContext = ref("");
  const loading = ref(false);

  return {
    t,
    activeNames,
    canTrial,
    scope,
    targetUser,
    formMode,
    boundMenuPks,
    targetPk,
    menuContext,
    loading
  };
}
