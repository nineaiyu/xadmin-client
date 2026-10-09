import { useRouter } from "vue-router";
import { shallowRef, type Ref, type UnwrapNestedRefs } from "vue";
import { hasAuth } from "@/router/utils";
import type { OperationProps } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";
import type { userApi } from "@/api/identity/user";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import Message from "~icons/ri/message-fill";
import Tag from "~icons/ri/price-tag-3-line";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";

type TFunction = ReturnType<typeof useI18n>["t"];
type Row = RecordType;

/**
 * 用户视图工具栏按钮（自 useUserButtons 抽出）：批量发送通知、批量打标、
 * 批量更新（勾选行后统一改启用状态）。打标入口按全局 `assign:Tag` 权限点显示
 * （对象级 update 权限由后端复核）。
 */
export function useUserToolbarButtons({
  t,
  api,
  tableRef,
  selectedNum,
  manySelectData,
  handleBatchTags
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  tableRef: Ref;
  selectedNum: Ref<number>;
  manySelectData: Ref<Row[]>;
  handleBatchTags: (pks: string[]) => void;
}) {
  const router = useRouter();
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

  return { tableBarButtonsProps };
}
