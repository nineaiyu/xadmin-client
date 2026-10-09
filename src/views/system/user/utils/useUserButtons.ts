import { ref, shallowRef, type Ref, type UnwrapNestedRefs } from "vue";
import type { OperationProps } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";
import type { userApi } from "@/api/system/user";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import Setting from "~icons/ri/settings-3-line";
import { useUserToolbarButtons } from "./useUserToolbarButtons";

type TFunction = ReturnType<typeof useI18n>["t"];
type Row = RecordType;

/**
 * 用户视图工具栏批量按钮与行内操作列（工具栏明细见 useUserToolbarButtons）：
 * 行内只保留「编辑 / 删除」（框架默认）与「管理」入口，其余行操作统一收敛到
 * 用户抽屉（ReActionPanel 通用模板，动作清单见 userActions.tsx）。
 */
export function useUserButtons({
  t,
  api,
  tableRef,
  handleBatchTags,
  openUserPanel
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  tableRef: Ref;
  handleBatchTags: (pks: string[]) => void;
  openUserPanel: (row: RecordType) => void;
}) {
  const selectedNum = ref(0);
  const manySelectData = ref<Row[]>([]);

  const selectionChange = (data: Row[]) => {
    manySelectData.value = data;
    selectedNum.value = manySelectData.value.length ?? 0;
  };

  const { tableBarButtonsProps } = useUserToolbarButtons({
    t,
    api,
    tableRef,
    selectedNum,
    manySelectData,
    handleBatchTags
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    // 列宽与「编辑/删除/管理」三个按钮的实际占用一致（表格固定列对齐按此收敛）
    width: 260,
    // 默认「查看 / 变更历史」入口收敛进抽屉，操作列保持三个动作
    hideDetail: true,
    hideChangeHistory: true,
    buttons: [
      {
        text: t("systemUser.manage"),
        code: "manage",
        props: {
          type: "primary",
          icon: useRenderIcon(Setting),
          link: true
        },
        onClick: ({ row }) => {
          openUserPanel(row);
        },
        show: true
      }
    ]
  });

  return { selectionChange, tableBarButtonsProps, operationButtonsProps };
}
