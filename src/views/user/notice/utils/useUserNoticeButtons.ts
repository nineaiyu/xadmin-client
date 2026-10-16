import { shallowRef, type Ref } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Success from "~icons/ep/success-filled";
import type { OperationProps } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 我的通知按钮装配（自 hook.tsx 抽出）：工具栏批量已读 / 全部已读，
 * 行内详情（打开通知弹窗）。
 */
export function useUserNoticeButtons({
  t,
  auth,
  selectedNum,
  unreadCount,
  onManyRead,
  onReadAll,
  openDetail
}: {
  t: TFunction;
  auth: { batchRead?: boolean; allRead?: boolean };
  selectedNum: Ref<number>;
  unreadCount: Ref<number>;
  onManyRead: () => void;
  onReadAll: () => void;
  openDetail: (row: RecordType) => void;
}) {
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("userNotice.batchRead"),
        code: "batchRead",
        props: {
          type: "success",
          icon: useRenderIcon(Success),
          plain: true
        },
        onClick: () => {
          onManyRead();
        },
        confirm: {
          title: () => {
            // 批量已读用独立文案：复用删除确认会误导（"确定批量删除 N 条数据吗？"）
            return t("userNotice.batchReadConfirm", {
              count: selectedNum.value
            });
          }
        },
        show: () => {
          return Boolean(auth.batchRead && selectedNum.value);
        }
      },
      {
        text: t("userNotice.allRead"),
        code: "allRead",
        props: {
          type: "primary"
        },
        onClick: () => {
          onReadAll();
        },
        show: () => {
          return Boolean(auth.allRead && unreadCount.value > 0);
        }
      }
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 100,
    buttons: [
      {
        code: "detail",
        text: t("buttons.detail"),
        onClick({ row }) {
          openDetail(row);
        },
        update: true
      }
    ]
  });

  return { tableBarButtonsProps, operationButtonsProps };
}
