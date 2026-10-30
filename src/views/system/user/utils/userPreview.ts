import { openPermissionPreview } from "@/components/RePermissionPreview/src/presets";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import PermissionPreview from "../components/PermissionPreview.vue";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 用户权限预览抽屉（统一走预览预设表，不在页面模板手挂 el-drawer） */
export function openUserPreview({ t, row }: { t: TFunction; row: RecordType }) {
  openPermissionPreview({
    entity: "user",
    row,
    t,
    component: PermissionPreview
  });
}
