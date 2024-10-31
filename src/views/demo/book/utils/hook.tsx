import { bookApi } from "./api";
import { getCurrentInstance, reactive } from "vue";
import { getDefaultAuths } from "@/router/utils";

export function useDemoBook() {
  // 权限判断，用于判断是否有该权限
  const api = reactive(bookApi);
  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance())
  });

  return {
    api,
    auth
  };
}
