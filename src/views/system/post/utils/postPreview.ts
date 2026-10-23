import { openPermissionPreview } from "@/components/RePermissionPreview/src/presets";
import type { PostItem } from "@/api/identity/post";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 岗位预览抽屉（与角色/部门/用户预览同体系：预览预设表统一打开） */
export function openPostPreview({ t, row }: { t: TFunction; row: PostItem }) {
  openPermissionPreview({ entity: "post", row, t });
}
