import { onMounted, ref } from "vue";
import { getCaptchaApi } from "@/api/auth";
import { useUserStoreHook } from "@/store/modules/user";

export const useImageVerify = () => {
  const imgCode = ref("");
  const imgUrl = ref("");

  function getImgCode() {
    getCaptchaApi().then(res => {
      if (res.code === 1000) {
        imgUrl.value = `${import.meta.env.VITE_API_DOMAIN}${res.captcha_image}`;
        imgCode.value = res.captcha_key;
        useUserStoreHook().SET_VERIFY_CODE_LENGTH(res.length);
      }
    });
  }

  onMounted(() => {
    getImgCode();
  });

  return {
    imgUrl,
    imgCode,
    getImgCode
  };
};
