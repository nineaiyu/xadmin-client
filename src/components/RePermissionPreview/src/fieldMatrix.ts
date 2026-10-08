import type { PreviewFieldRow } from "@/api/types/permission-preview";

/** 单模型字段白名单 */
export interface FieldMatrixModel {
  model: string;
  model_label: string;
  fields: string[];
  field_labels: string[];
}

/** 归一化后的字段权限条目（菜单 × 角色 × 模型 → 字段白名单） */
export interface FieldMatrixEntry {
  /** 唯一键（菜单主键，缺省回落菜单标题） */
  key: string;
  menu: string;
  role?: string;
  models: FieldMatrixModel[];
}

/** 分组形态（角色/部门预览：一条含多个模型） */
interface GroupedFieldRow {
  menu: { pk: string; title: string };
  role?: { pk: string; name: string };
  models: FieldMatrixModel[];
}

type FieldRowInput = PreviewFieldRow | GroupedFieldRow;

/**
 * 字段权限数据归一：扁平形态（用户预览一行一个模型）与分组形态
 * （角色/部门预览一行含 models[]）统一为 `FieldMatrixEntry[]`，
 * 供字段矩阵渲染件以同一份结构驱动表格与折叠两种形态。
 */
export function toFieldMatrixEntries(
  items: FieldRowInput[]
): FieldMatrixEntry[] {
  return items.map(item => {
    const models: FieldMatrixModel[] =
      "models" in item
        ? item.models
        : [
            {
              model: item.model,
              model_label: item.model_label,
              fields: item.fields,
              field_labels: item.field_labels
            }
          ];
    return {
      key: item.menu.pk || item.menu.title,
      menu: item.menu.title,
      role: item.role?.name,
      models
    };
  });
}
