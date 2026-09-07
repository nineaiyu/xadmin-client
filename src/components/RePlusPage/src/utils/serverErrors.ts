/**
 * UX-2：服务端字段级校验错误内联展示。
 *
 * 后端全局异常处理器将 DRF 校验错误封装为 `errors: {field: [msgs]}`（见
 * common/core/exception.py），本模块把命中的字段错误直接写入 el-form-item
 * 的 `validateState`/`validateMessage`，以行内红字呈现（el-form 官方语义，
 * 用户修改字段后自动清除）；未命中表单项的错误仍走全局 toast。
 */

type ServerErrors = Record<string, string[] | string | undefined>;

interface FieldLike {
  prop?: string;
  field?: string;
  validateState?: string;
  validateMessage?: string;
}

function firstMessage(msgs: string[] | string | undefined): string | undefined {
  if (msgs == null) return undefined;
  const msg = Array.isArray(msgs) ? msgs[0] : msgs;
  return msg == null || msg === "" ? undefined : String(msg);
}

/**
 * 将服务端错误写入表单项。返回命中的字段数（0 表示全部未命中，
 * 调用方可据此保留全局 toast 行为）。
 *
 * formEl 为 el-form 实例（RePlusPage 的 ExposedFormInstance），其 `fields`
 * 为 el-form-item 实例数组；这里以运行时结构访问，避免与组件类型耦合。
 */
export function applyServerErrors(
  formEl: unknown,
  errors: ServerErrors | null | undefined
): number {
  if (!formEl || !errors || typeof errors !== "object") return 0;
  const fields = (formEl as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return 0;
  let applied = 0;
  for (const item of fields as FieldLike[]) {
    const prop = item?.prop ?? item?.field;
    if (prop == null) continue;
    const msg = firstMessage(errors[prop]);
    if (msg != null) {
      item.validateState = "error";
      item.validateMessage = msg;
      applied++;
    }
  }
  return applied;
}
