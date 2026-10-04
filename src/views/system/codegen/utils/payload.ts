import type {
  CodegenPayload,
  CodegenFieldOverride
} from "@/api/system/codegen";

/** 代码生成页表单状态（与生成方案一一对应，可整体保存 / 载入） */
export type CodegenFormState = {
  model: string;
  component: string;
  url_prefix: string;
  frontend_dir: string;
  /** 列表视图默认排序（单字段，可带 - 前缀；留空按引擎推导） */
  ordering: string;
  menu_title: string;
  menu_parent: string;
  menu_icon: string;
  with_import_export: boolean;
  with_tags: boolean;
  with_tests: boolean;
  with_module: boolean;
  module_id: string;
  module_level: string;
  /** AI 动作声明骨架（默认生成） */
  with_ai: boolean;
  /** 前端三件产物（默认生成） */
  with_frontend: boolean;
  skip_menu_seed: boolean;
  /** 字段级覆盖：全量有序清单（顺序即生成字段序） */
  fields: CodegenFieldOverride[];
};

export const MODULE_LEVELS = ["core", "standard", "optional"] as const;

export function defaultFormState(): CodegenFormState {
  return {
    model: "",
    component: "",
    url_prefix: "",
    frontend_dir: "",
    ordering: "",
    menu_title: "",
    menu_parent: "",
    menu_icon: "",
    with_import_export: false,
    with_tags: false,
    with_tests: false,
    with_module: false,
    module_id: "",
    module_level: "optional",
    with_ai: true,
    with_frontend: true,
    skip_menu_seed: false,
    fields: []
  };
}

/** 表单状态 → 请求载荷：空串收敛为 undefined（后端按缺省推导） */
export function buildPayload(state: CodegenFormState): CodegenPayload {
  const payload: CodegenPayload = {
    model: state.model,
    with_import_export: state.with_import_export,
    with_tags: state.with_tags,
    with_tests: state.with_tests,
    with_module: state.with_module,
    skip_ai: !state.with_ai,
    skip_frontend: !state.with_frontend,
    skip_menu_seed: state.skip_menu_seed
  };
  if (state.component.trim()) payload.component = state.component.trim();
  if (state.url_prefix.trim()) payload.url_prefix = state.url_prefix.trim();
  if (state.frontend_dir.trim())
    payload.frontend_dir = state.frontend_dir.trim();
  if (state.ordering.trim()) payload.ordering = state.ordering.trim();
  if (state.menu_title.trim()) payload.menu_title = state.menu_title.trim();
  if (state.menu_parent) payload.menu_parent = state.menu_parent;
  if (state.menu_icon) payload.menu_icon = state.menu_icon;
  if (state.with_module && state.module_id.trim())
    payload.module_id = state.module_id.trim();
  if (state.with_module && state.module_level)
    payload.module_level = state.module_level;
  if (state.fields.length) payload.fields = state.fields;
  return payload;
}

/** 批量下载载荷：多模型 + 共享开关（忽略字段级覆盖与模型专属命名） */
export function buildBatchPayload(
  models: string[],
  state: CodegenFormState
): CodegenPayload {
  return {
    models,
    menu_title: state.menu_title.trim() || undefined,
    menu_parent: state.menu_parent || undefined,
    menu_icon: state.menu_icon || undefined,
    with_import_export: state.with_import_export,
    with_tags: state.with_tags,
    with_tests: state.with_tests,
    with_module: state.with_module,
    module_id:
      state.with_module && state.module_id.trim()
        ? state.module_id.trim()
        : undefined,
    module_level: state.with_module ? state.module_level : undefined,
    skip_ai: !state.with_ai,
    skip_frontend: !state.with_frontend,
    skip_menu_seed: state.skip_menu_seed
  };
}

/** 载入方案时的结构兜底：补齐新增键（旧方案文件向后兼容） */
export function normalizeFormState(raw: unknown): CodegenFormState {
  const base = defaultFormState();
  if (!raw || typeof raw !== "object") return base;
  const source = raw as Partial<CodegenFormState>;
  const state: CodegenFormState = {
    ...base,
    ...source,
    fields: Array.isArray(source.fields)
      ? source.fields.filter(
          field =>
            !!field &&
            typeof field === "object" &&
            typeof field.name === "string"
        )
      : [],
    module_level: MODULE_LEVELS.includes(
      source.module_level as (typeof MODULE_LEVELS)[number]
    )
      ? source.module_level!
      : base.module_level
  };
  return state;
}
