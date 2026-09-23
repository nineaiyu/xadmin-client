/**
 * 服务端字段级校验错误内联展示 + 失败定位（U-4）。
 *
 * 后端全局异常处理器将 DRF 校验错误封装为 `errors: {field: [msgs]}`（见
 * common/core/exception.py），本模块把命中的字段错误直接写入 el-form-item
 * 的 `validateState`/`validateMessage`，以行内红字呈现（el-form 官方语义，
 * 用户修改字段后自动清除）；未命中表单项的错误仍走全局 toast。
 *
 * 定位（长表单 / 多页签场景，用户「找不到错在哪」）：
 * - 命中后自动滚动到首个错误字段（el-form 的 `scrollToField`）并聚焦其输入框；
 * - 分页签表单（`_allInstances`）先切到错误所在页签（调用方传入 activateTab），
 *   等下一个 tick DOM 切换完成后再滚动聚焦；聚焦行为符合 a11y（焦点可见）。
 */

import { nextTick } from "vue";

type ServerErrors = Record<string, string[] | string | undefined>;

interface FieldLike {
  prop?: string;
  field?: string;
  validateState?: string;
  validateMessage?: string;
  $el?: HTMLElement;
}

interface FormInstanceLike {
  fields?: unknown;
  scrollToField?: (prop: string) => void;
  _allInstances?: unknown;
}

/** 定位选项：分页签表单由调用方提供页签切换（AddOrEdit 的 setActiveName） */
export interface ServerErrorOptions {
  activateTab?: (index: number) => void;
}

function firstMessage(msgs: string[] | string | undefined): string | undefined {
  if (msgs == null) return undefined;
  const msg = Array.isArray(msgs) ? msgs[0] : msgs;
  return msg == null || msg === "" ? undefined : String(msg);
}

function focusField(instance: FormInstanceLike, prop: string) {
  const fields = instance.fields;
  if (!Array.isArray(fields)) return;
  const field = (fields as FieldLike[]).find(
    item => (item?.prop ?? item?.field) === prop
  );
  const root = field?.$el;
  const target = root?.querySelector?.(
    "input, textarea, select, [tabindex]"
  ) as HTMLElement | null | undefined;
  try {
    target?.focus?.({ preventScroll: true });
  } catch {
    // 老浏览器不支持 options：忽略，滚动已由 scrollToField 完成
  }
}

/**
 * 将服务端错误写入表单项并定位首个错误。返回命中的字段数
 * （0 表示全部未命中，调用方可据此保留全局 toast 行为）。
 *
 * formEl 为 el-form 实例（RePlusPage 的 ExposedFormInstance），其 `fields`
 * 为 el-form-item 实例数组；这里以运行时结构访问，避免与组件类型耦合。
 */
export function applyServerErrors(
  formEl: unknown,
  errors: ServerErrors | null | undefined,
  options?: ServerErrorOptions
): number {
  if (!formEl || !errors || typeof errors !== "object") return 0;
  const root = formEl as FormInstanceLike;
  const allInstances =
    Array.isArray(root._allInstances) && root._allInstances.length > 0
      ? (root._allInstances as FormInstanceLike[])
      : [root];

  let applied = 0;
  let firstHit: {
    instance: FormInstanceLike;
    index: number;
    prop: string;
  } | null = null;
  allInstances.forEach((instance, index) => {
    const fields = instance?.fields;
    if (!Array.isArray(fields)) return;
    for (const item of fields as FieldLike[]) {
      const prop = item?.prop ?? item?.field;
      if (prop == null) continue;
      const msg = firstMessage(errors[prop]);
      if (msg != null) {
        item.validateState = "error";
        item.validateMessage = msg;
        applied++;
        if (!firstHit) firstHit = { instance, index, prop };
      }
    }
  });

  if (firstHit) {
    const target = firstHit as {
      instance: FormInstanceLike;
      index: number;
      prop: string;
    };
    // 跨页签：先切换到错误所在页签（下一个 tick 等 DOM 渲染完再滚动聚焦）
    if (allInstances.length > 1) {
      options?.activateTab?.(target.index);
    }
    nextTick(() => {
      try {
        target.instance.scrollToField?.(target.prop);
      } catch {
        // 非 el-form 实例/字段不可见：忽略定位，错误提示仍已内联
      }
      focusField(target.instance, target.prop);
    });
  }
  return applied;
}
