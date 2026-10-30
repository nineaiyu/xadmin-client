import type { FormInstance, FormItemProp } from "element-plus";
import { clone } from "@pureadmin/utils";
import { getCurrentScope, onScopeDispose, ref } from "vue";

export const useVerifyCode = () => {
  // 每个调用方独立状态：模块级单例会让登录页发码禁用
  // 「绑定邮箱」弹窗的发码按钮（跨场景共享冷却）、重开弹窗仍是禁用态，
  // 且模块级计时器永不随组件卸载清理
  const isDisabled = ref(false);
  const timer = ref<number | null>(null);
  const text = ref("");
  // 组件卸载即停表：调用方均在 setup 域内；无作用域的直接
  // 调用（单测/工具函数）跳过注册，避免 Vue 警告
  if (getCurrentScope()) {
    onScopeDispose(() => clearInterval(timer.value ?? undefined));
  }
  const start = async (
    formEl: FormInstance | undefined,
    props: FormItemProp,
    time = 60,
    callback: ((interval: (time: number) => void) => void) | null = null
  ) => {
    if (!formEl) return;
    await formEl.validateField(props, isValid => {
      if (isValid) {
        if (callback) {
          callback(interval);
        } else {
          interval(time);
        }
      }
    });
  };

  const interval = (time: number) => {
    clearInterval(timer.value ?? undefined);
    const initTime = clone(time, true);
    isDisabled.value = true;
    text.value = `${time}`;
    timer.value = window.setInterval(() => {
      if (time > 0) {
        time -= 1;
        text.value = `${time}`;
      } else {
        text.value = "";
        isDisabled.value = false;
        clearInterval(timer.value ?? undefined);
        time = initTime;
      }
    }, 1000);
  };

  const end = () => {
    text.value = "";
    isDisabled.value = false;
    clearInterval(timer.value ?? undefined);
  };

  return {
    isDisabled,
    timer,
    text,
    start,
    end
  };
};
