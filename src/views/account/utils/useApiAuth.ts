import { computed, reactive } from "vue";
import { hasAuth } from "@/router/utils";
import { userInfoApi } from "@/api/user/userinfo";

/** 个人中心 API 面与权限集（资料 / 账户管理共用；自 utils/hook 拆出，行为不变） */
export function useApiAuth() {
  const api = reactive({
    retrieve: userInfoApi.retrieve,
    bind: userInfoApi.bind,
    partialUpdate: userInfoApi.partialUpdate,
    resetPassword: userInfoApi.resetPassword,
    upload: userInfoApi.upload,
    choices: userInfoApi.choices
  });

  const auth = computed(() => ({
    upload: hasAuth("upload:UserInfo"),
    partialUpdate: hasAuth("partialUpdate:UserInfo"),
    bind: hasAuth("bind:UserInfo"),
    resetPassword: hasAuth("resetPassword:UserInfo")
  }));
  return {
    api,
    auth
  };
}
