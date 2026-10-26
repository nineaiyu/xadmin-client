import { h, type Component } from "vue";
import type { useI18n } from "vue-i18n";
import { addDrawer } from "@/components/ReDrawer";
import { drawerSize, type DrawerSizeName } from "@/components/ReDialog/size";
import { PREVIEW_FETCHERS } from "./fetchers";

type TFunction = ReturnType<typeof useI18n>["t"];

export type PermissionPreviewEntity = "user" | "dept" | "role" | "post";

export type PreviewPreset = {
  titleKey: string;
  size: DrawerSizeName;
  fetch: (pk: string) => Promise<unknown>;
};

/**
 * 权限预览预设表：四个实体只差抽屉标题 / 宽度与取数端点，页面侧统一经
 * `openPermissionPreview` 打开，不再各自拼 addDrawer 参数。
 *
 * 内容组件由页面层（views/system/<domain>/utils/*Preview）传入：组件库不反向
 * 依赖 views 层，`check:module-cycles` 的 FORBIDDEN_EDGES 守护该方向。
 */
export const PREVIEW_PRESETS = {
  user: {
    titleKey: "permissionPreview.userTitle",
    size: "xl",
    fetch: PREVIEW_FETCHERS.user
  },
  dept: {
    titleKey: "permissionPreview.deptTitle",
    size: "xl",
    fetch: PREVIEW_FETCHERS.dept
  },
  role: {
    titleKey: "permissionPreview.roleTitle",
    size: "lg",
    fetch: PREVIEW_FETCHERS.role
  },
  post: {
    titleKey: "permissionPreview.postTitle",
    size: "lg",
    fetch: PREVIEW_FETCHERS.post
  }
} satisfies Record<PermissionPreviewEntity, PreviewPreset>;

/** 打开权限只读预览抽屉（ReDrawer，关闭即销毁） */
export function openPermissionPreview({
  entity,
  row,
  t,
  component
}: {
  entity: PermissionPreviewEntity;
  row: { pk?: string | number };
  t: TFunction;
  component: Component;
}) {
  const preset = PREVIEW_PRESETS[entity] as PreviewPreset | undefined;
  if (!preset) return;
  addDrawer({
    title: t(preset.titleKey),
    size: drawerSize(preset.size),
    destroyOnClose: true,
    hideFooter: true,
    contentRenderer: () => h(component, { row })
  });
}
