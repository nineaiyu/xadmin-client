import { h, type Component } from "vue";
import type { useI18n } from "vue-i18n";
import { addDrawer } from "@/components/ReDrawer";
import { drawerSize, type DrawerSizeName } from "@/components/ReDialog/size";
import RolePermissionPreview from "@/views/system/role/components/RolePermissionPreview.vue";
import PermissionPreview from "@/views/system/user/components/PermissionPreview.vue";
import PostPermissionPreview from "@/views/system/post/components/PostPermissionPreview.vue";
import DeptPermissionPreview from "@/views/system/dept/components/DeptPermissionPreview.vue";
import { PREVIEW_FETCHERS } from "./fetchers";

type TFunction = ReturnType<typeof useI18n>["t"];

export type PermissionPreviewEntity = "user" | "dept" | "role" | "post";

export type PreviewPreset = {
  titleKey: string;
  size: DrawerSizeName;
  component: Component;
  fetch: (pk: string) => Promise<unknown>;
};

/**
 * 权限预览预设表：四个实体只差抽屉标题 / 宽度 / 内容组件与取数端点，
 * 页面侧统一经 `openPermissionPreview` 打开，不再各自拼 addDrawer 参数。
 */
export const PREVIEW_PRESETS = {
  user: {
    titleKey: "permissionPreview.userTitle",
    size: "xl",
    component: PermissionPreview,
    fetch: PREVIEW_FETCHERS.user
  },
  dept: {
    titleKey: "permissionPreview.deptTitle",
    size: "xl",
    component: DeptPermissionPreview,
    fetch: PREVIEW_FETCHERS.dept
  },
  role: {
    titleKey: "permissionPreview.roleTitle",
    size: "lg",
    component: RolePermissionPreview,
    fetch: PREVIEW_FETCHERS.role
  },
  post: {
    titleKey: "permissionPreview.postTitle",
    size: "lg",
    component: PostPermissionPreview,
    fetch: PREVIEW_FETCHERS.post
  }
} satisfies Record<PermissionPreviewEntity, PreviewPreset>;

/** 打开权限只读预览抽屉（ReDrawer，关闭即销毁） */
export function openPermissionPreview({
  entity,
  row,
  t
}: {
  entity: PermissionPreviewEntity;
  row: { pk?: string | number };
  t: TFunction;
}) {
  const preset = PREVIEW_PRESETS[entity] as PreviewPreset | undefined;
  if (!preset) return;
  addDrawer({
    title: t(preset.titleKey),
    size: drawerSize(preset.size),
    destroyOnClose: true,
    hideFooter: true,
    contentRenderer: () => h(preset.component, { row })
  });
}
