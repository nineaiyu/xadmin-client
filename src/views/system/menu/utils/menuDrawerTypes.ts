import type { Reactive, Ref } from "vue";
import type { menuApi } from "@/api/system/menu";
import type { useI18n } from "vue-i18n";
import type {
  MenuAuths,
  MenuChoiceItem,
  MenuFormModel,
  MenuRow,
  MenuUrlItem,
  ModelTreeItem
} from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 菜单抽屉装配依赖（自 useMenuDrawer 抽出，控制单文件行数） */
export interface MenuDrawerDeps {
  api: Reactive<typeof menuApi>;
  auth: MenuAuths;
  t: TFunction;
  treeData: Ref<MenuRow[]>;
  rowIndex: Ref<{ byPk: Map<string, MenuRow> }>;
  choicesDict: Ref<Record<string, MenuChoiceItem[]>>;
  modelList: Ref<ModelTreeItem[]>;
  viewList: Ref<Record<string, string>>;
  menuUrlList: Ref<MenuUrlItem[]>;
  saveNode: (
    model: MenuFormModel,
    isAdd: boolean
  ) => Promise<{ code: number; detail?: string }>;
  renameNode: (
    row: MenuRow,
    title: string
  ) => Promise<{ code: number; detail?: string }>;
  setRowsActive: (rows: MenuRow[], isActive: boolean) => Promise<boolean>;
  reload: () => void;
  /** 保存后定位到该节点（可选） */
  onSaved?: (pk: number | string | undefined, isAdd: boolean) => void;
}

/** 未保存变更的处置结果 */
export type UnsavedChoice = "save" | "discard" | "cancel";
