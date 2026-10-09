import { displayTitle } from "./useMenuFilter";
import { emptyFormModel, inferType, toFormModel } from "./normalize";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { MenuFormModel, MenuRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 抽屉打开函数（由 useMenuDrawer 提供） */
type OpenDrawer = (
  model: MenuFormModel,
  isAdd: boolean,
  title: string,
  pk?: number | string
) => void;

/** 新增（无父级 = 顶级；有父级 = 其子级，类型按父级推断） */
export function openMenuCreate({
  t,
  open,
  parent
}: {
  t: TFunction;
  open: OpenDrawer;
  parent?: MenuRow | null;
}) {
  const model = emptyFormModel(parent ?? null, inferType(parent ?? null));
  if (parent) model.parent = parent.pk;
  open(
    model,
    true,
    parent
      ? t("systemMenu.dialog.addChild", { title: displayTitle(parent) })
      : t("systemMenu.dialog.add")
  );
}

/** 编辑 */
export function openMenuEdit({
  t,
  open,
  row
}: {
  t: TFunction;
  open: OpenDrawer;
  row: MenuRow;
}) {
  open(toFormModel(row), false, t("systemMenu.dialog.edit"), row.pk);
}

/** 克隆：以现有节点为模板打开新增（同父级，标题/编码加副本后缀，先改后存） */
export function openMenuClone({
  t,
  open,
  rowIndex,
  row
}: {
  t: TFunction;
  open: OpenDrawer;
  rowIndex: Ref<{ byPk: Map<string, MenuRow> }>;
  row: MenuRow;
}) {
  const source = rowIndex.value.byPk.get(String(row.pk)) ?? row;
  const model = toFormModel(source);
  model.pk = undefined;
  model.title = t("systemMenu.dialog.cloneSuffix", {
    title: displayTitle(source)
  });
  model.name = `${source.name}_copy`;
  model.isActive = false;
  open(model, true, t("systemMenu.dialog.clone"));
}
