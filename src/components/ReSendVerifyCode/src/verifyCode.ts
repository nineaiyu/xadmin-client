import type { FormInstance, FormItemProp } from "element-plus";
import { clone } from "@pureadmin/utils";
import { ref } from "vue";

const isDisabled = ref(false);
const timer = ref(null);
const text = ref("");

export const useVerifyCode = () => {
  const start = async (
    formEl: FormInstance | undefined,
    props: FormItemProp,
    time = 60,
    callback = null
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
    clearInterval(timer.value);
    const initTime = clone(time, true);
    isDisabled.value = true;
    text.value = `${time}`;
    timer.value = setInterval(() => {
      if (time > 0) {
        time -= 1;
        text.value = `${time}`;
      } else {
        text.value = "";
        isDisabled.value = false;
        clearInterval(timer.value);
        time = initTime;
      }
    }, 1000);
  };

  const end = () => {
    text.value = "";
    isDisabled.value = false;
    clearInterval(timer.value);
  };

  return {
    isDisabled,
    timer,
    text,
    start,
    end
  };
};
