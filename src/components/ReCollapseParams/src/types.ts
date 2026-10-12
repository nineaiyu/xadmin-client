/** 参数可编辑值（表单控件绑定） */
export type CollapseParamValue = string | number | boolean | null | undefined;

export interface CollapseParamOption {
  type?: "exponential" | "number" | "select" | "string";
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  /** type=select 时的候选项 */
  options?: Array<{ label: string; value: string | number }>;
}

export interface CollapseParamSchema {
  /** 参数键（同时作为行标识与值的键） */
  key: string;
  /** 参数展示名（缺省展示 key） */
  label?: string;
  /** 参数说明（展示在第三列） */
  description: string;
  defaultValue?: CollapseParamValue;
  option?: CollapseParamOption;
}

export type CollapseParamValues = Record<string, CollapseParamValue>;

export interface ReCollapseParamsProps {
  /** 参数 schema 列表 */
  params: CollapseParamSchema[];
  /** 折叠前可见行数（至少 1） */
  visibleCount?: number;
  /** 初始是否展开 */
  defaultOpen?: boolean;
  /** 展开后内容区最大高度（number 视为 px） */
  maxHeight?: number | string;
}
