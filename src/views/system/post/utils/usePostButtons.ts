import { shallowRef } from "vue";
import type { OperationProps } from "@/components/RePlusPage";
import type { PostItem } from "@/api/identity/post";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 岗位页按钮显隐开关（装配期由 hook 计算的权限位收敛） */
export type PostButtonFlags = {
  canAssign: boolean;
  canViewMembers: boolean;
  canPreview: boolean;
};

/**
 * 岗位页行操作按钮装配：只保留页面专属的「成员 / 预览」。
 *
 * 编辑与新增由框架元数据表单提供（`auth.create/partialUpdate` 未关闭），
 * 删除保留框架默认入口；这里不再重复声明编辑按钮。
 */
export function usePostButtons({
  t,
  flags,
  openMembers,
  openPreview
}: {
  t: TFunction;
  flags: PostButtonFlags;
  openMembers: (row: PostItem, readonly?: boolean) => void;
  openPreview: (row: PostItem) => void;
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    // 默认按钮（编辑 / 删除 / 详情）+ 成员 / 预览 同行排布：默认按钮占用
    // -30 ~ -10，自定义按钮从 8 起排，showNumber 覆盖全部以免折进「更多」
    showNumber: 6,
    width: 300,
    buttons: [
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

  return { operationButtonsProps };
}
