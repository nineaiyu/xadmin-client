import { useRouter } from "vue-router";
import { shallowRef, type Ref, type UnwrapNestedRefs } from "vue";
import { hasAuth } from "@/router/utils";
import type { OperationProps } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";
import type { userApi } from "@/api/system/user";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import Setting from "~icons/ri/settings-3-line";
import Message from "~icons/ri/message-fill";
import Tag from "~icons/ri/price-tag-3-line";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";

type TFunction = ReturnType<typeof useI18n>["t"];

type Row = RecordType;

/**
 * 用户视图工具栏批量按钮与行内操作列：
 * 行内只保留「编辑 / 删除」（框架默认）与「管理」入口，其余行操作统一收敛到
 * 用户抽屉（UserActionPanel，动作清单见 userActions.tsx）。
 */
export function useUserButtons({
  t,
  api,
  tableRef,
  selectedNum,
  manySelectData,
  handleBatchTags,
  openUserPanel
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  tableRef: Ref;
  selectedNum: Ref<number>;
  manySelectData: Ref<Row[]>;
  handleBatchTags: (pks: string[]) => void;
  openUserPanel: (row: RecordType) => void;
}) {
  const router = useRouter();
  // 通用标签：打标入口按全局权限点显示（对象级 update 权限由后端复核）
  const canAssignTags = hasAuth("assign:Tag");

  function goNotice() {
    const users: RecordType[] = [];
    manySelectData.value.forEach(user => {
      users.push({
        pk: user.pk,
        username: user.username
      });
    });
    router.push({
      name: "SystemNotice",
      query: { notice_user: JSON.stringify(users) }
    });
  }

  const selectionChange = (data: Row[]) => {
    manySelectData.value = data;
    selectedNum.value = manySelectData.value.length ?? 0;
  };

  // 批量更新：勾选行后统一写入同组字段（字段白名单：启用状态）
  const { batchUpdateButton } = useBatchUpdate({
    t,
    api,
    tableRef,
    fields: [
      {
        key: "is_active",
        label: t("commonLabels.is_active"),
        input_type: "boolean"
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("systemUser.batchSendNotice"),
        code: "batchSendNotice",
        props: {
          type: "primary",
          icon: useRenderIcon(Message),
          plain: true
        },
        onClick: () => {
          goNotice();
        },
        show: () => {
          return Boolean(hasAuth("create:SystemNotice") && selectedNum.value);
        }
      },
      {
        // 批量打标：标签此前只能逐行从「更多」菜单进入，勾选后可一次性追加/移除/替换
        text: t("tag.batchAssignTitle"),
        code: "batchTags",
        props: {
          type: "primary",
          icon: useRenderIcon(Tag),
          plain: true
        },
        onClick: () => {
          handleBatchTags(manySelectData.value.map(item => String(item.pk)));
        },
        show: () => Boolean(canAssignTags && selectedNum.value)
      },
      batchUpdateButton
    ]
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
