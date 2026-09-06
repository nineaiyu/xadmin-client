import { createApp } from "vue";
import { withInstall } from "@pureadmin/utils";
import { i18n } from "@/plugins/i18n";
import reMfaConfirm from "./src/index.vue";
import type { MfaConfirmMethodResult } from "@/api/mfa";

/** 身份二次验证对话框组件 */
export const ReMfaConfirm = withInstall(reMfaConfirm);

export type MfaConfirmResult = {
  expire_at: number | null;
};

/** 进行中的验证共享 Promise：并发 412 只弹一个窗，全部等待同一次验证 */
let pendingConfirm: Promise<MfaConfirmResult> | null = null;

/**
 * 命令式唤起身份二次验证对话框。
 *
 * 用于 http 层捕获 412（type=user_confirm_required）后挂起请求，
 * 验证成功 resolve、用户取消 reject；包装层在结束后自动卸载组件。
 */
export function confirmMfa(confirmType = "mfa"): Promise<MfaConfirmResult> {
  if (pendingConfirm) return pendingConfirm;

  pendingConfirm = new Promise<MfaConfirmResult>((resolve, reject) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let app: ReturnType<typeof createApp> | null = null;

    const destroy = () => {
      app?.unmount();
      container.remove();
    };

    app = createApp(reMfaConfirm, {
      confirmType,
      resolve: (result: MfaConfirmResult) => {
        resolve(result);
        // 等待关闭动画结束后再卸载
        setTimeout(destroy, 300);
      },
      reject: () => {
        reject(new Error("mfa-confirm-cancelled"));
        setTimeout(destroy, 300);
      },
      destroy
    });
    // 命令式挂载不在组件树内，手动安装 i18n 插件保证模板内 $t 可用
    app.use(i18n);
    app.mount(container);
  }).finally(() => {
    pendingConfirm = null;
  });

  return pendingConfirm;
}

/** 前端类型引用：供消费方判断 412 载荷 */
export type { MfaConfirmMethodResult };
