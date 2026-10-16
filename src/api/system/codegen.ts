import type { AxiosResponse } from "axios";
import { BaseApi } from "@/api/base";
import type { BaseResult, DetailResult, ListResult } from "@/api/types";

/** 代码生成方案的资源基址（与生成器端点同前缀但独立路由） */
const PLANS_BASE = "/api/system/codegen-plans";

/** 可生成 CRUD 的模型项 */
export type CodegenModelItem = {
  label: string;
  app_label: string;
  verbose_name: string;
  table: string;
  field_count: number;
};

/** 可绑定的数据字典类型（字段编辑器字典下拉数据源） */
export type CodegenDictType = {
  code: string;
  label: string;
};

/** 选中模型的字段计划项（逐字段默认面，GUI 字段表格的初始值） */
export type CodegenFieldItem = {
  name: string;
  verbose_name: string;
  type: string;
  in_table: boolean;
  in_search: boolean;
  /** 是否允许开启搜索（JSON/文件类字段引擎不进过滤域，前端禁用开关） */
  can_search: boolean;
  required: boolean;
  is_relation: boolean;
  has_choices: boolean;
  /** 关联字段的引擎默认 input_type（如 api-search-user） */
  default_input_type: string;
  /** 是否文本类（可生成 icontains 自定义过滤器） */
  can_filter_custom: boolean;
};

export type CodegenModelPlan = {
  label: string;
  verbose_name: string;
  defaults: { component: string; url_prefix: string; frontend_dir: string };
  fields: CodegenFieldItem[];
  dict_types: CodegenDictType[];
};

/** 字段级覆盖（顺序即字段序；未提及字段保持引擎推导） */
export type CodegenFieldOverride = {
  name: string;
  /** false = 从序列化器字段面排除（pk 不可排除） */
  include?: boolean;
  /** 显示名覆盖（extra_kwargs.label） */
  label?: string;
  required?: boolean;
  read_only?: boolean;
  /** 表格列 */
  in_table?: boolean;
  /** 搜索表单 */
  in_search?: boolean;
  /** input_type 覆盖（仅关联字段） */
  input_type?: string;
  /** 绑定数据字典类型 code（仅非关联字段，生成 DictChoiceField） */
  dict_code?: string;
};

/** 生成产物（path = 仓库相对路径，如 xadmin-server/demo/views.py） */
export type CodegenArtifact = {
  label: string;
  path: string;
  content: string;
  mode: string;
  key: string;
  notice?: string;
};

/** 生成器表单载荷（preview / download 共用；批量打包时以 models 代替 model） */
export type CodegenPayload = {
  model?: string;
  component?: string;
  url_prefix?: string;
  frontend_dir?: string;
  /** 菜单种子上级菜单 pk（留空 = 顶级） */
  menu_parent?: string;
  /** 菜单种子标题（留空 = 模型 verbose_name） */
  menu_title?: string;
  /** 菜单种子图标（留空 = ep:document） */
  menu_icon?: string;
  /** 列表视图默认排序（单字段，可带 - 前缀；留空按引擎推导） */
  ordering?: string;
  /** 字段级覆盖（全量有序清单） */
  fields?: CodegenFieldOverride[];
  /** 旧口径：include/exclude 黑白名单（保留 API 兼容，页面已改用 fields） */
  include_fields?: string[];
  exclude_fields?: string[];
  with_import_export?: boolean;
  with_tags?: boolean;
  with_tests?: boolean;
  with_module?: boolean;
  /** AI 动作声明骨架开关（skip 语义，默认生成） */
  skip_ai?: boolean;
  /** 前端产物开关（skip 语义，默认生成） */
  skip_frontend?: boolean;
  module_id?: string;
  module_level?: string;
  skip_menu_seed?: boolean;
  /** 批量打包（download 专用）：多模型共享表单选项，逐模型走引擎默认字段计划 */
  models?: string[];
};

/** 代码生成方案（服务端存储）：本人可见全部，`is_shared` 打开后同页其他用户只读可见 */
export type CodegenPlanItem = {
  pk: string;
  name: string;
  /** 表单状态全文（CodegenFormState 序列化结果，读侧回填后归一） */
  payload: Record<string, unknown>;
  description?: string | null;
  is_shared: boolean;
  creator?: unknown;
  created_time?: string;
  updated_time?: string;
};

/** 代码生成方案写入载荷（create / update 共用，同名保存覆盖）
 *
 * `payload` 为表单状态对象（CodegenFormState），读侧由 `normalizeFormState` 收窄；
 * 此处用 `object` 承载以避免与 `views/system/codegen/utils/payload` 形成类型环。
 */
export type CodegenPlanPayload = {
  name: string;
  payload: object;
  is_shared?: boolean;
  description?: string;
};

class SystemCodeGenApi extends BaseApi {
  models = () => {
    return this.request<DetailResult<CodegenModelItem[]>>(
      "get",
      {},
      {},
      `${this.baseApi}/models`
    );
  };
  modelFields = (label: string) => {
    return this.request<DetailResult<CodegenModelPlan>>(
      "get",
      { label },
      {},
      `${this.baseApi}/model-fields`
    );
  };
  preview = (payload: CodegenPayload) => {
    return this.request<DetailResult<CodegenArtifact[]>>(
      "post",
      {},
      payload,
      `${this.baseApi}/preview`
    );
  };
  /** zip 下载（blob；拦截器对非 JSON 响应返回完整 response，blob 在 .data） */
  download = (payload: CodegenPayload) => {
    return this.request<AxiosResponse<Blob>>(
      "post",
      {},
      payload,
      `${this.baseApi}/download`,
      { responseType: "blob" }
    );
  };
  /** 方案列表（取值域「本人 + 共享」，服务端分页） */
  planList = () => {
    return this.request<ListResult<CodegenPlanItem>>(
      "get",
      { page: 1, size: 1000 },
      {},
      PLANS_BASE
    );
  };
  /** 保存方案（同名覆盖，服务端 upsert） */
  planSave = (payload: CodegenPlanPayload) => {
    return this.request<DetailResult<CodegenPlanItem>>(
      "post",
      {},
      payload,
      PLANS_BASE
    );
  };
  /** 重命名 / 更新方案（仅本人可写） */
  planUpdate = (pk: string, payload: Partial<CodegenPlanPayload>) => {
    return this.request<DetailResult<CodegenPlanItem>>(
      "patch",
      {},
      payload,
      `${PLANS_BASE}/${pk}`
    );
  };
  /** 删除方案（仅本人可删） */
  planRemove = (pk: string) => {
    return this.request<BaseResult>("delete", {}, {}, `${PLANS_BASE}/${pk}`);
  };
}

export const systemCodeGenApi = new SystemCodeGenApi("/api/system/codegen");
