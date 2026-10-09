import { h } from "vue";
import { addDrawer } from "@/components/ReDrawer";
import PostPermissionPreview from "../components/PostPermissionPreview.vue";
import type { PostItem } from "@/api/identity/post";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 岗位预览抽屉（与角色/部门预览同体系：ReDrawer，不在页面模板手挂 el-drawer） */
export function openPostPreview({ t, row }: { t: TFunction; row: PostItem }) {
  addDrawer({
    title: t("permissionPreview.postTitle"),
    size: "60%",
    destroyOnClose: true,
    hideFooter: true,
    contentRenderer: () => h(PostPermissionPreview, { row })
  });
}
