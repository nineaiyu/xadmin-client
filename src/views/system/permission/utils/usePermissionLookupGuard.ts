import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { Auths } from "@/router/utils";
import type { usePermissionLookups } from "./usePermissionLookups";

/**
 * 数据权限页依赖守卫：菜单/字段注册表不可用时给出可读原因，
 * 并关闭新增/编辑（空表单只能配出无效规则）。
 */
export function usePermissionLookupGuard(
  lookups: ReturnType<typeof usePermissionLookups>,
  auth: Auths
) {
  const { t } = useI18n();

  const lookupAlert = computed(() => {
    if (lookups.missingPermissions.value.length) {
      return t("systemPermission.lookupMissing", {
        permissions: lookups.missingPermissions.value.join(", ")
      });
    }
    if (lookups.lookupBlocked.value) {
      return t("systemPermission.lookupLoadFailed");
    }
    return "";
  });

  watch(
    lookupAlert,
    value => {
      if (!value) return;
      auth.create = false;
      auth.update = false;
      // 编辑按钮的显示条件是 (partialUpdate || update)：只关 update 仍会露出口子
      auth.partialUpdate = false;
    },
    { immediate: true }
  );

  return { lookupAlert };
}
