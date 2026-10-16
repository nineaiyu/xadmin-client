import { shallowRef } from "vue";
import type { OperationProps } from "@/components/RePlusPage";
import type { PostItem } from "@/api/identity/post";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 岗位页按钮显隐开关（装配期由 hook 计算的权限位收敛） */
export type PostButtonFlags = {
  canCreate: boolean;
  canEdit: boolean;
  canAssign: boolean;
  canViewMembers: boolean;
  canPreview: boolean;
};

/** 岗位页工具栏（新建）与行操作（编辑/成员/预览）按钮装配（自 hook.tsx 抽出） */
export function usePostButtons({
  t,
  flags,
  openDialog,
  openMembers,
  openPreview
}: {
  t: TFunction;
  flags: PostButtonFlags;
  openDialog: (row: PostItem | null) => void;
  openMembers: (row: PostItem, readonly?: boolean) => void;
  openPreview: (row: PostItem) => void;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 4,
    width: 220,
    buttons: [
      {
        text: t("post.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as PostItem),
        show: flags.canEdit,
        index: 10
      },
      {
        text: t("post.members"),
        code: "members",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openMembers(row as PostItem, !flags.canAssign),
        show: flags.canAssign || flags.canViewMembers,
        index: 9
      },
      {
        text: t("post.preview"),
        code: "preview",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openPreview(row as PostItem),
        show: flags.canPreview,
        index: 8
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("post.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => openDialog(null),
        show: flags.canCreate
      }
    ]
  });

  return { tableBarButtonsProps, operationButtonsProps };
}
