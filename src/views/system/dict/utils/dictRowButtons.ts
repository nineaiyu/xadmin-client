import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import AddFill from "~icons/ri/add-circle-line";
import ArrowUp from "~icons/ep/arrow-up-bold";
import ArrowDown from "~icons/ep/arrow-down-bold";
import { isDictTypeRow } from "./dictColumnRules";
import type { OperationButtonsRow } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 字典行内按钮（自 hook.tsx 抽出）：新增子项（类型行专属）+ 上移/下移 */
export function buildDictRowButtons({
  t,
  auth,
  onAddChild,
  onMove
}: {
  t: TFunction;
  auth: { create?: boolean; move?: boolean };
  onAddChild: (row: RecordType) => void;
  onMove: (
    row: RecordType,
    direction: "up" | "down",
    loading: { value: boolean }
  ) => void;
}): OperationButtonsRow[] {
  return [
    {
      text: t("dataDict.addChild"),
      code: "addChild",
      props: { type: "primary", icon: useRenderIcon(AddFill), link: true },
      onClick: ({ row }) => onAddChild(row),
      show: row => Boolean(auth.create && isDictTypeRow(row)),
      index: -40
    },
    {
      text: t("dataDict.moveUp"),
      code: "moveUp",
      props: { type: "info", icon: useRenderIcon(ArrowUp), link: true },
      onClick: ({ row, loading }) => onMove(row, "up", loading),
      show: auth.move,
      index: 2
    },
    {
      text: t("dataDict.moveDown"),
      code: "moveDown",
      props: { type: "info", icon: useRenderIcon(ArrowDown), link: true },
      onClick: ({ row, loading }) => onMove(row, "down", loading),
      show: auth.move,
      index: 3
    }
  ];
}
