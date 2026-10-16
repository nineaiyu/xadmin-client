/** 数据字典页共享行类型 */

/** 数据字典行：parent 为空 = 字典类型，非空 = 字典项（模型只支持两级） */
export type DictRow = {
  pk?: string | number;
  label?: string;
  color?: string | null;
  parent_code?: string | null;
  parent?: { pk?: string | number; label?: string } | string | number | null;
  is_locked?: boolean;
  children?: DictRow[];
};

/** 列表单元格渲染所需字段（cellRenderer 上下文 row 为宽容形态，按读取字段收窄） */
export type DictCellRow = {
  label?: string;
  color?: string | null;
  parent_code?: string | null;
  parent?: { label?: string } | null;
  is_locked?: boolean;
};
