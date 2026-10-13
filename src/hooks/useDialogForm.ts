import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import type { DataEnvelope } from "@/api/types";
import type { Ref } from "vue";

/**
 * 弹窗表单（ReDialog + XxxForm）提交底座。
 *
 * 现状样板（全库 60+ 处）逐份手写 `beforeSure`：校验守卫 → 调接口 → 成功 done /
 * 失败提示并复位按钮 loading。手写样板的两个已知缺陷类：
 * 1. payload 未通过校验时漏写 `closeLoading()` → 确定按钮永久转圈；
 * 2. 提交未 `catch(normalizeError)` → beforeSure 抛错 → 同上（loading 悬挂）。
 *
 * 本 hook 把三步收敛为一次调用，缺陷防线内置（有单测钉住）；调用点只需提供
 * `submit` 动作与可选文案/回调。
 *
 * 用法（标准形态；successText 传 i18n 文案的求值结果）：
 * ```ts
 * const formRef = ref<InstanceType<typeof XxxForm>>();
 * // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
 * const { beforeSure } = useDialogForm<Record<string, unknown>>({
 *   formRef,
 *   submit: payload => (row ? api.partialUpdate(row.pk, payload) : api.create(payload)),
 *   successText: saveOkText,
 *   onSuccess: refresh
 * });
 * addDialog({ ..., contentRenderer: () => h(XxxForm, { ref: formRef, row }), beforeSure });
 * ```
 */

/** 弹窗表单内容组件的载荷契约：null / undefined 表示校验未通过（保持弹窗） */
export type DialogFormPayloadHost<TPayload> = {
  getPayload: () => TPayload | null | undefined;
};

/** ReDialog `beforeSure` 的第二参数中本 hook 使用的部分 */
type BeforeSureContext = { closeLoading: () => void };

export function useDialogForm<TPayload>(options: {
  /** 载荷读取：模板 ref 形态（常用；与 readPayload 二选一） */
  formRef?: Ref<DialogFormPayloadHost<TPayload> | undefined>;
  /** 载荷读取：自定义函数形态（ref 语义不适用时使用，如 onReady 显式注册实例） */
  readPayload?: () => TPayload | null | undefined;
  /** 提交动作：hook 内部统一 `catch(normalizeError)` 归一网络异常 */
  submit: (payload: TPayload) => Promise<DataEnvelope>;
  /** 成功提示文案（不传则不提示） */
  successText?: string;
  /** 成功后回调（`done()` 已调用；通常用于刷新列表或读取创建结果 res.data） */
  onSuccess?: (res: DataEnvelope) => void;
  /** 失败提示类型（默认 warning） */
  failType?: "error" | "warning";
  /** 自定义失败处理（给定时不做默认 detail 提示） */
  onFail?: (res: DataEnvelope) => void;
}) {
  const readPayload =
    options.readPayload ?? (() => options.formRef?.value?.getPayload());

  /**
   * 供 ReDialog `beforeSure` 直接使用：
   * 校验守卫 → 提交（异常归一）→ 成功 `done()` / 失败提示并 `closeLoading()`。
   */
  async function beforeSure(done: () => void, ctx: BeforeSureContext) {
    const payload = readPayload();
    if (payload === null || payload === undefined) {
      // 校验未通过：必须复位 loading，否则确定按钮永久转圈
      ctx.closeLoading();
      return;
    }
    const res = await options.submit(payload).catch(normalizeError);
    if (isSuccess(res)) {
      if (options.successText) {
        message(options.successText, { type: "success" });
      }
      done();
      options.onSuccess?.(res);
      return;
    }
    if (options.onFail) {
      options.onFail(res);
    } else if (res.detail) {
      message(String(res.detail), { type: options.failType ?? "warning" });
    }
    ctx.closeLoading();
  }

  return { beforeSure };
}
