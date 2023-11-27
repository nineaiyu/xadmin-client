import "./reset.css";
import { message } from "@/utils/message";
import type { FormItemProps } from "./types";
import {
  updateUserInfoApi,
  uploadUserInfoAvatarApi,
  updateUserInfoPasswordApi
} from "@/api/userinfo";
import { ref, onMounted, reactive } from "vue";
import { useUserStoreHook } from "@/store/modules/user";
import { useI18n } from "vue-i18n";
import { delay } from "@pureadmin/utils";

export function useUserInfo() {
  const { t } = useI18n();
  const loading = ref(true);
  // 上传头像信息
  const currentUserInfo = reactive<FormItemProps>({
    avatar: "",
    nickname: "",
    username: ""
  });

  function handleUpdate(row) {
    updateUserInfoApi(row).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  async function onSearch() {
    loading.value = true;
    useUserStoreHook()
      .getUserInfo()
      .then(res => {
        if (res.code === 1000) {
          Object.keys(res.data).forEach(param => {
            currentUserInfo[param] = res.data[param];
          });
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
    const avatarFile = new File([info], "avatar.png", {
      type: info.type,
      lastModified: Date.now()
    });
    const data = new FormData();
    data.append("file", avatarFile);
    uploadUserInfoAvatarApi({}, data).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function handleResetPassword(data) {
    updateUserInfoPasswordApi(data).then(async res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }
  onMounted(() => {
    onSearch();
  });

  return {
    t,
    currentUserInfo,
    handleUpload,
    handleUpdate,
    handleResetPassword
  };
}
