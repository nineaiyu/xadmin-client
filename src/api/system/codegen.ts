import type { AxiosResponse } from "axios";
import { BaseApi } from "@/api/base";
import type { DetailResult } from "@/api/types";

/** 可生成 CRUD 的模型项 */
export type CodegenModelItem = {
  label: string;
  app_label: string;
  verbose_name: string;
  table: string;
  field_count: number;
};

/** 选中模型的字段计划项 */
export type CodegenFieldItem = {
  name: string;
  verbose_name: string;
  type: string;
  in_table: boolean;
  required: boolean;
};

export type CodegenModelPlan = {
  label: string;
  verbose_name: string;
  defaults: { component: string; url_prefix: string; frontend_dir: string };
  fields: CodegenFieldItem[];
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

/** 生成器表单载荷（preview / download 共用） */
export type CodegenPayload = {
  model: string;
  component?: string;
  url_prefix?: string;
  frontend_dir?: string;
  include_fields?: string[];
  exclude_fields?: string[];
  with_import_export?: boolean;
  with_tags?: boolean;
  with_module?: boolean;
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
}

export const systemCodeGenApi = new SystemCodeGenApi("/api/system/codegen");
