import { h } from "vue";
import { addDrawer } from "@/components/ReDrawer";
import RolePermissionPreview from "../components/RolePermissionPreview.vue";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 角色权限预览抽屉（统一走 ReDrawer，不在页面模板手挂 el-drawer） */
export function openRolePreview({ t, row }: { t: TFunction; row: RecordType }) {
  addDrawer({
    title: t("permissionPreview.roleTitle"),
    size: "60%",
    destroyOnClose: true,
    hideFooter: true,
    contentRenderer: () => h(RolePermissionPreview, { row })
  });
}
