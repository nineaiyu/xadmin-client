import { SUCCESS_CODE } from "@/api/types";
import "./reset.css";
import { useI18n } from "vue-i18n";
import { createFormData, delay } from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import type { ChoicesLabel, FormItemProps, FormPasswordProps } from "./types";
import type { RecordType } from "plus-pro-components";
import { onMounted, reactive, ref } from "vue";
import { userInfoApi } from "@/api/user/userinfo";
import { useUserStoreHook } from "@/store/modules/user";
import { AesEncrypted } from "@/utils/aes";
import avatar from "@/assets/avatar.png";

export function useApiAuth() {
  const api = reactive({
    retrieve: userInfoApi.retrieve,
    partialUpdate: userInfoApi.partialUpdate,
    resetPassword: userInfoApi.resetPassword,
    upload: userInfoApi.upload
  });

  const auth = reactive({
    upload: hasAuth("upload:UserInfo"),
    partialUpdate: hasAuth("partialUpdate:UserInfo"),
    resetPassword: hasAuth("resetPassword:UserInfo")
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
  const genderChoices = ref<ChoicesLabel[]>([]);

  // 上传头像信息
  const currentUserInfo = reactive<FormItemProps>({
    avatar: "",
    nickname: "",
    username: ""
  });

  function handleUpdate(row: FormItemProps) {
    api.partialUpdate({}, row).then(res => {
      if (res.code === SUCCESS_CODE) {
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
        if (res.code === SUCCESS_CODE) {
          const data = res.data as RecordType;
          Object.keys(data).forEach(param => {
            (currentUserInfo as unknown as RecordType)[param] = data[param];
          });
          if (!currentUserInfo.avatar) {
            currentUserInfo.avatar = avatar;
          }
          genderChoices.value = (res.choices_dict ??
            []) as unknown as ChoicesLabel[];
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
      });
    delay(500).then(() => {
      loading.value = false;
    });
  }

  /** 上传头像 */
  function handleUpload(info: Blob) {
    const formData = createFormData({
      file: new File([info], "avatar.png", {
        type: info.type,
        lastModified: Date.now()
      })
    });
    api.upload(formData).then(res => {
      if (res.code === SUCCESS_CODE) {
        message(t("results.success"), { type: "success" });
        getUserInfo();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  async function handleResetPassword(data: FormPasswordProps) {
    const old_password = await AesEncrypted(
      currentUserInfo.username,
      data.old_password
    );
    const sure_password = await AesEncrypted(
      currentUserInfo.username,
      data.sure_password as string
    );
    api.resetPassword({ old_password, sure_password }).then(async res => {
      if (res.code === SUCCESS_CODE) {
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
