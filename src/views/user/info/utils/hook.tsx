import "./reset.css";
import { useI18n } from "vue-i18n";
import { createFormData, delay } from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import type { FormItemProps } from "./types";
import { onMounted, reactive, ref } from "vue";
import { userInfoApi } from "@/api/user/userinfo";
import { useUserStoreHook } from "@/store/modules/user";
import { AesEncrypted } from "@/utils/aes";
import avatar from "@/assets/avatar.png";

export function useApiAuth() {
  const api = reactive({
    detail: userInfoApi.detail,
    update: userInfoApi.patch,
    reset: userInfoApi.reset,
    upload: userInfoApi.upload
  });

  const auth = reactive({
    upload: hasAuth("upload:UserInfo"),
    update: hasAuth("update:UserInfo"),
    reset: hasAuth("reset:UserInfo")
  });
  return {
    api,
    auth
  };
}

export function useUserInfo() {
  const { t } = useI18n();
  const { api, auth } = useApiAuth();

  const loading = ref(true);
  const genderChoices = ref([]);

  // 上传头像信息
  const currentUserInfo = reactive<FormItemProps>({
    avatar: "",
    nickname: "",
    username: ""
  });

  function handleUpdate(row) {
    api.update({}, row).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        getUserInfo();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function getUserInfo() {
    loading.value = true;
    useUserStoreHook()
      .getUserInfo()
      .then(res => {
        if (res.code === 1000) {
          Object.keys(res.data).forEach(param => {
            currentUserInfo[param] = res.data[param];
          });
          if (!currentUserInfo.avatar) {
            currentUserInfo.avatar = avatar;
          }
          genderChoices.value = res.choices_dict;
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
      });
    delay(500).then(() => {
      loading.value = false;
    });
  }

  /** 上传头像 */
  function handleUpload(info) {
    const formData = createFormData({
      file: new File([info], "avatar.png", {
        type: info.type,
        lastModified: Date.now()
      })
    });
    api.upload(formData).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        getUserInfo();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function handleResetPassword(data) {
    api
      .reset({
        old_password: AesEncrypted(currentUserInfo.username, data.old_password),
        sure_password: AesEncrypted(
          currentUserInfo.username,
          data.sure_password
        )
      })
      .then(async res => {
        if (res.code === 1000) {
          message(t("results.success"), { type: "success" });
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
      });
  }

  onMounted(() => {
    getUserInfo();
  });

  return {
    t,
    auth,
    genderChoices,
    currentUserInfo,
    handleUpload,
    handleUpdate,
    handleResetPassword
  };
}
