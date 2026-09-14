import { BaseApi } from "@/api/base";

/** 动态表单：收敛控件集 schema + 通用 JSON 提交 */
export type FormFieldType =
  | "input"
  | "textarea"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "date"
  | "switch";

export type FormField = {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  max_length?: number;
  placeholder?: string;
};

export type DynamicFormItem = {
  pk: string;
  name: string;
  description: string;
  schema: { fields: FormField[] };
  is_active: boolean;
  /** 提交需审批（412 → 审批通过 → 携令牌重放自动落库） */
  approval_required: boolean;
};

export type SubmissionItem = {
  pk: string;
  form: string;
  form_name: string;
  data: Record<string, unknown>;
  creator?: { username: string };
  created_time: string;
};

export const dynamicFormApi = new BaseApi("/api/system/dynamic-forms");
export const submissionApi = new BaseApi(
  "/api/system/dynamic-form-submissions"
);

/** 列表结果取行：统一实现在 api/base.ts */
export { listRows } from "@/api/base";
