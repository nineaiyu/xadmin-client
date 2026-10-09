/**
 * 设置表单的字段宽度：按控件形态分配栅格占位（档位常量见 `@/utils/formSpan`）。
 *
 * 设置页字段绝大多数是单行控件，统一拉满整行会让输入框过长——视线要在标签与
 * 控件之间来回横扫，超宽屏下尤其明显。这里只区分两种形态：
 *
 * - 整行：多行 / 大块控件（长文本编辑器、JSON、上传），窄列会把内容压扁；
 * - 单行档：其余全部（含开关），靠一行多列把控件宽度收住。
 *
 * 不再用 max_length 推断宽度：设置项的 CharField 普遍声明 128~1024 上限，
 * 按「长文本」升整行会让几乎所有字段又回到通栏。
 */

import {
  FORM_SPAN_FULL,
  FORM_SPAN_FIELD,
  type FormFieldSpan
} from "@/utils/formSpan";

/** 需要整行的控件形态（多行 / 大块内容） */
const FULL_WIDTH_INPUT_TYPES = new Set([
  "textarea",
  "json",
  "image upload",
  "file upload",
  "object_related_field_file",
  "object_related_field_image",
  "m2m_related_field_file",
  "m2m_related_field_image"
]);

/** 判定宽度所需的最小字段面（取元数据里决定宽度的键，便于单测与复用） */
export interface SettingFieldMeta {
  input_type?: string | null;
}

/**
 * 解析字段的栅格占位。
 *
 * 入参为 `search-columns` 下发的字段元数据（`PageColumn._column`）；缺失或未识别的
 * 形态统一按单行档处理——比整行紧凑，也不会把短控件压到不可用。
 */
export function resolveSettingFieldSpan(
  meta?: SettingFieldMeta | null
): FormFieldSpan {
  const inputType = String(meta?.input_type ?? "");
  if (FULL_WIDTH_INPUT_TYPES.has(inputType)) return FORM_SPAN_FULL;
  return FORM_SPAN_FIELD;
}
