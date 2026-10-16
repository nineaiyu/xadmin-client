/**
 * 菜单权限码生成弹窗（含 C-/U- 预览，dry_run 与执行共用同一构造逻辑）。
 * 自 useMenuDrawer 拆出（行为不变）：与抽屉核心状态无耦合，仅依赖
 * 菜单接口清单与保存成功后的刷新回调。
 */

import { h, ref, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import MenuPermissionDialog from "../components/MenuPermissionDialog.vue";
import type { MenuRow, MenuUrlItem } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

export function useMenuPermissionCode({
  t,
  menuUrlList,
  reload
}: {
  t: TFunction;
  menuUrlList: Ref<MenuUrlItem[]>;
  reload: () => void;
}) {
  /** 生成权限码（含 C-/U- 预览，dry_run 与执行共用同一构造逻辑） */
  const openPermission = (row: MenuRow) => {
    const dialogRef = ref();
    addDialog({
      title: t("systemMenu.addPermissions"),
      width: dialogSize("lg"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(MenuPermissionDialog, {
          ref: dialogRef,
          row,
          menuUrlList: menuUrlList.value
        }),
      beforeSure: (done, { closeLoading }) => {
        dialogRef.value
          ?.submit?.()
          .then((ok: boolean) => {
            if (ok) {
              done();
              reload();
            }
            closeLoading();
          })
          .catch(() => closeLoading());
      }
    });
  };

  return {
    openPermission
  };
}
