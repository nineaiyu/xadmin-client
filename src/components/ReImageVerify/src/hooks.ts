import { onMounted, ref } from "vue";
import { getCaptchaApi } from "@/api/auth";
import { useUserStoreHook } from "@/store/modules/user";
import { delay } from "@pureadmin/utils";

export const useImageVerify = imgCode => {
  // const imgCode = ref("");
  const imgUrl = ref("");
  const loading = ref(false);

  function getImgCode() {
    loading.value = true;
    getCaptchaApi()
      .then(res => {
        if (res.code === 1000) {
          imgUrl.value = res.captcha_image;
          imgCode.value = res.captcha_key;
          useUserStoreHook().SET_VERIFY_CODE_LENGTH(res.length);
        }
      })
      .finally(() => {
        delay(100).then(() => {
          loading.value = false;
        });
      });
  }

  onMounted(() => {
    getImgCode();
  });

  return {
    imgUrl,
    loading,
    imgCode,
    getImgCode
  };
};
