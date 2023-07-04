import { onMounted, ref } from "vue";
import { getCaptchaApi } from "@/api/auth";
import { useUserStoreHook } from "@/store/modules/user";

export const useImageVerify = () => {
  const imgCode = ref("");
  const imgUrl = ref("");

  const apiDomain = res => {
    const httpReg = /^http(s?):\/\//;
    if (
      import.meta.env.VITE_API_DOMAIN &&
      httpReg.test(import.meta.env.VITE_API_DOMAIN)
    ) {
      return `${import.meta.env.VITE_API_DOMAIN}${res.captcha_image}`;
    }
    return res.captcha_image;
  };

  function getImgCode() {
    getCaptchaApi().then(res => {
      if (res.code === 1000) {
        imgUrl.value = apiDomain(res);
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
