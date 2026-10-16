import { computed } from "vue";
import { useUserStoreHook } from "@/store/modules/user";

/**
 * 站点级外观配置（站点标题 / Logo 品牌位 / 登录页布局）的可编辑性。
 *
 * 这类键由后端写入系统级配置（对所有账号与登录页一致，见 ConfigsViewSet 的
 * 站点级键分流），仅超管可改；其余账号在面板中只读，避免「改了只对自己生效」
 * 的误解。其余偏好键仍是个人的（个人配置行覆盖 + 回落系统值）。
 */
export function useSiteWideEdit() {
  const userStore = useUserStoreHook();
  const siteWideEditable = computed(() => Boolean(userStore.is_superuser));
  return { siteWideEditable };
}
