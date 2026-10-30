/**
 * 兼容 shim：尺寸档位已迁至 `@/components/overlay/size`。
 *
 * 存量 80+ 处 `@/components/ReDialog/size` 引用继续可用；新代码引用共享层，
 * 避免抽屉使用者依赖对话框目录。
 */
export {
  DIALOG_SIZES,
  DRAWER_SIZES,
  DRAWER_NARROW_WIDTH,
  dialogSize,
  drawerSize
} from "@/components/overlay/size";
export type { DialogSizeName, DrawerSizeName } from "@/components/overlay/size";
