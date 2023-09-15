import "./reset.css";
import { message } from "@/utils/message";
import { FormItemProps } from "./types";
import {
  updateUserInfoApi,
  uploadUserInfoAvatarApi,
  updateUserInfoPasswordApi
} from "@/api/userinfo";
import { ref, onMounted, reactive } from "vue";
import { useUserStoreHook } from "@/store/modules/user";

export function useUserInfo() {
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
        message(res.detail, { type: "success" });
        onSearch();
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
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
          message(`操作失败，${res.detail}`, { type: "error" });
        }
      });
    setTimeout(() => {
      loading.value = false;
    }, 500);
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
        message("头像更新成功", { type: "success" });
        onSearch();
      } else {
        message("头像上传失败" + res.detail, { type: "error" });
      }
    });
  }

  function handleResetPassword(data) {
    updateUserInfoPasswordApi(data).then(async res => {
      if (res.code === 1000) {
        message(`已成功修改本人密码`, {
          type: "success"
        });
      } else {
        message(`操作失败，${res.detail}`, { type: "error" });
      }
    });
  }
  onMounted(() => {
    onSearch();
  });

  return {
    currentUserInfo,
    handleUpload,
    handleUpdate,
    handleResetPassword
  };
}
