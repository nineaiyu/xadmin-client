import { computed, ref } from "vue";
import { isFunction } from "@pureadmin/utils";
import type { useI18n } from "vue-i18n";
import { dialogOrDrawer } from "./context";
import type {
  OverlayArgs,
  OverlayBaseOptions,
  OverlayButtonProps,
  OverlayDoneFn
} from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 弹层页脚共享逻辑：默认「取消 / 保存」按钮、`sureBtnLoading` 状态键、
 * 关闭前守卫 `beforeClose` 与取消/保存回调编排。ReDialog / ReDrawer 只传
 * 各自的 store 操作与状态清理函数，页脚行为保持同源；自定义 `footerButtons`
 * 仍原样透传（调用方可完全接管按钮区）。
 */
export function useOverlayFooter<
  TOptions extends OverlayBaseOptions<TOptions>
>({
  close,
  getUid,
  t,
  allowDeprecatedPopConfirm = false,
  clearRuntimeState
}: {
  close: (options: TOptions, index: number, args?: OverlayArgs) => void;
  getUid: (options: TOptions) => number | undefined;
  t: TFunction;
  /** 抽屉历史选项同时接受 popConfirm 旧别名；对话框保持只认 popconfirm */
  allowDeprecatedPopConfirm?: boolean;
  /** 关闭时清理组件私有运行时状态（如对话框全屏标记） */
  clearRuntimeState?: (options: TOptions, index: number) => void;
}) {
  const sureBtnMap = ref<Record<string | number, { loading?: boolean }>>({});

  /** 关闭前守卫：未配置 `beforeClose` 时直接放行；配置后由调用方决定何时 `done()`。 */
  function handleBeforeClose(options: TOptions, done: OverlayDoneFn) {
    if (options.beforeClose && isFunction(options.beforeClose)) {
      options.beforeClose(done);
      return;
    }
    done();
  }

  function handleClose(options: TOptions, index: number, args?: OverlayArgs) {
    const uid = getUid(options) ?? index;
    delete sureBtnMap.value[uid];
    clearRuntimeState?.(options, index);
    close(options, index, args);
  }
  const footerButtons = computed(() => {
    return (options: TOptions): OverlayButtonProps[] => {
      if ((options.footerButtons?.length ?? 0) > 0) {
        return options.footerButtons as OverlayButtonProps[];
      }
      return [
        {
          label: t("buttons.cancel"),
          text: true,
          bg: true,
          btnClick: ctx => {
            const { options: target, index } = dialogOrDrawer<TOptions>(ctx);
            const done = () =>
              handleClose(target, index, { command: "cancel" });
            const closeWithGuard = () => handleBeforeClose(target, done);
            if (target.beforeCancel && isFunction(target.beforeCancel)) {
              target.beforeCancel(closeWithGuard, {
                options: target,
                index
              });
            } else {
              closeWithGuard();
            }
          }
        },
        {
          label: options.sureBtnText || t("buttons.save"),
          type: "primary",
          text: true,
          bg: true,
          // 稳定标识：footer loading 按 code 判定（替代数组下标魔法数）
          code: "sure",
          popconfirm:
            options.popconfirm ??
            (allowDeprecatedPopConfirm ? options.popConfirm : undefined),
          btnClick: ctx => {
            const { options: target, index } = dialogOrDrawer<TOptions>(ctx);
            // 以弹层唯一标识（回退下标）作为状态键，避免多弹层并存时下标漂移串状态
            const uid = getUid(target) ?? index;
            if (target.sureBtnLoading) {
              const prev = sureBtnMap.value[uid];
              sureBtnMap.value[uid] = { ...prev, loading: true };
            }
            // 条目可能已被关闭路径删除（done() 先于 closeLoading 调用）
            const closeLoading = () => {
              if (target.sureBtnLoading && sureBtnMap.value[uid]) {
                sureBtnMap.value[uid].loading = false;
              }
            };
            const done = () => handleClose(target, index, { command: "sure" });
            if (target.beforeSure && isFunction(target.beforeSure)) {
              target.beforeSure(done, {
                options: target,
                index,
                closeLoading
              });
            } else {
              done();
            }
          }
        }
      ];
    };
  });
  return { sureBtnMap, footerButtons, handleBeforeClose, handleClose };
}
