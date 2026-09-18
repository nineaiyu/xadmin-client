import { BaseApi } from "@/api/base";
import type { BaseResult, DataListResult } from "@/api/types";

/** 动态表单：收敛控件集 schema + 通用 JSON 提交 */
export type FormFieldType =
  | "input"
  | "textarea"
  | "number"
  | "amount"
  | "select"
  | "radio"
  | "checkbox"
  | "date"
  | "switch"
  | "upload"
  | "daterange"
  | "table"
  | "user"
  | "cascader";

/** 级联选项节点（value 同时作为提交值，label 为展示文案） */
export type FormCascaderOption = {
  value: string | number;
  label: string;
  children?: FormCascaderOption[];
};

/** 展开的选项：平铺控件为字符串数组，级联为树形节点数组 */
export type FormFieldOption = string | FormCascaderOption;

/** 明细子表列类型：限基础控件，禁止嵌套 table / upload / daterange */
export type FormTableColumnType =
  "input" | "textarea" | "number" | "date" | "select";

export type FormTableColumn = {
  key: string;
  label: string;
  type: FormTableColumnType;
  options?: string[];
};

export type FormField = {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  /** 平铺控件为字符串数组；级联（cascader）为树形节点数组 */
  options?: FormFieldOption[];
  min?: number;
  max?: number;
  max_length?: number;
  /** 金额控件（amount）最多保留的小数位（0-6，缺省不限） */
  precision?: number;
  /** 选人控件（user）是否多选 */
  multiple?: boolean;
  placeholder?: string;
  /** 明细子表列定义（type=table 时必填） */
  columns?: FormTableColumn[];
};

export type DynamicFormItem = {
  pk: string;
  name: string;
  description: string;
  schema: { fields: FormField[] };
  is_active: boolean;
  /** 提交需审批（走操作审批：审批通过后自动落库） */
  approval_required: boolean;
  /** 绑定审批流程：非空时提交进入流程引擎（多级审批，终态回写提交状态） */
  approval_flow?: { pk: string; label?: string } | null;
};

/** 可填报表单（available-forms 返回结构：流程字段给名称与主键，不回传整个定义） */
export type FillableFormItem = {
  pk: string;
  name: string;
  description: string;
  schema: { fields: FormField[] };
  approval_required: boolean;
  approval_flow?: string | null;
  approval_flow_pk?: string | null;
};

/** 填报状态：空 = 无需审批已生效；绑定流程后随流程实例终态回写 */
export type SubmissionStatusValue =
  "" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type SubmissionItem = {
  pk: string;
  form: string;
  form_name: string;
  data: Record<string, unknown>;
  status?: { value: SubmissionStatusValue; label: string } | null;
  instance?: string | null;
  creator?: { username: string };
  created_time: string;
};

/** 选人控件候选（user-options）：仅基本展示字段 */
export type FormUserOption = {
  pk: number;
  username: string;
  nickname: string;
};

class SubmissionApi extends BaseApi {
  /** 选人控件数据源：关键字搜索 / 按主键回显已选用户（≤20 条） */
  userOptions = (params: { keyword?: string; pks?: number[] }) => {
    const query: Record<string, unknown> = {};
    if (params.keyword) query.keyword = params.keyword;
    if (params.pks?.length) query.pks = params.pks.join(",");
    return this.request<DataListResult<FormUserOption>>(
      "get",
      query,
      {},
      `${this.baseApi}/user-options`
    );
  };

  /** 重新提交被驳回的填报（仅申请人、仅驳回态） */
  resubmit = (pk: string) => {
    return this.request<BaseResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/resubmit`
    );
  };

  /**
   * 可填报表单（启用中）：填报页数据源。
   * 定义类资源不走行级数据权限过滤，普通员工无需「表单设计器」权限即可填报。
   */
  availableForms = () => {
    return this.request<DataListResult>(
      "get",
      {},
      {},
      `${this.baseApi}/available-forms`
    );
  };
}

export const dynamicFormApi = new BaseApi("/api/system/dynamic-forms");
export const submissionApi = new SubmissionApi(
  "/api/system/dynamic-form-submissions"
);

/** 列表结果取行：统一实现在 api/base.ts */
export { listRows } from "@/api/base";
