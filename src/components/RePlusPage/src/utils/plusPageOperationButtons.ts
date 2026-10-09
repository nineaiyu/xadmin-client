import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { handleShowChangeHistory } from "./handle-history";
import View from "~icons/ep/view";
import Delete from "~icons/ep/delete";
import EditPen from "~icons/ep/edit-pen";
import FileList from "~icons/ri/file-list-3-line";
import type { OperationButtonsRow } from "@/components/RePlusPage";
import type { ApiAuthProps } from "./types";
import type { BaseApi } from "@/api/base";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 默认操作列按钮（自 usePlusPageButtons.ts 抽出）：编辑 / 删除 / 详情 / 变更历史。
 * 页面级开关（hideEdit / hideDetail / hideChangeHistory）逐项收敛，未声明时
 * 保持原行为（按钮按权限点显隐）。
 */
export function buildDefaultOperationButtons({
  t,
  api,
  auth,
  hideEdit,
  hideDetail,
  hideChangeHistory,
  hasDetailFetch,
  handleAddOrEdit,
  handleDelete,
  handleDetail
}: {
  t: TFunction;
  api: Partial<BaseApi>;
  auth: Partial<ApiAuthProps>;
  hideEdit: boolean;
  hideDetail: boolean;
  hideChangeHistory: boolean;
  /** 页面挂了详情兜底拉取：拉取期间按钮 loading（加载中兜底） */
  hasDetailFetch: boolean;
  handleAddOrEdit: (isAdd?: boolean, row?: Record<string, unknown>) => void;
  handleDelete: (
    row: { pk?: string | number; id?: string | number },
    requestEnd?: (options?: object) => void
  ) => void;
  handleDetail: (row: Record<string, unknown>) => void | Promise<void>;
}): OperationButtonsRow[] {
  // 行级归属守卫：写守卫域（如 dataset 域 1003）的序列化器在行数据下发
  // is_owner（creator 本人或超管为 true），默认编辑/删除按钮按行收敛；
  // 未下发标志的行（undefined）不收敛，保持既有页面零回归。
  const ownerAllows = (row?: Record<string, unknown>) =>
    row?.is_owner !== false;

  return [
    {
      text: t("buttons.edit"),
      code: "update",
      props: {
        type: "primary",
        icon: useRenderIcon(EditPen),
        link: true
      },
      onClick: ({ row }) => {
        handleAddOrEdit(false, row);
      },
      index: -30,
      show: row =>
        Boolean(
          !hideEdit && (auth.partialUpdate || auth.update) && ownerAllows(row)
        )
    },
    {
      text: t("buttons.delete"),
      code: "delete",
      confirm: { title: t("buttons.confirmDelete") },
      props: {
        type: "danger",
        icon: useRenderIcon(Delete),
        link: true
      },
      onClick: ({ row, loading }) => {
        loading.value = true;
        handleDelete(row, () => {
          loading.value = false;
        });
      },
      index: -20,
      show: row => Boolean(auth.destroy && ownerAllows(row))
    },
    {
      code: "detail",
      props: {
        type: "primary",
        icon: useRenderIcon(View),
        link: true,
        // icon-only 按钮：tooltip 不产生可编程可访问名（axe button-name critical），
        // 必须显式提供 aria-label（种子/演示数据让列表有行后，a11y 扩面扫描即暴露）；
        // 键名用 "aria-label" 字符串：ariaLabel 驼峰透传到 DOM 会丢失连字符而失效
        "aria-label": t("buttons.detail")
      },
      onClick: ({ row, loading }) => {
        if (hasDetailFetch) {
          loading.value = true;
          Promise.resolve(handleDetail(row)).finally(() => {
            loading.value = false;
          });
        } else {
          handleDetail(row);
        }
      },
      tooltip: { content: t("buttons.detail") },
      index: -10,
      show: hideDetail ? false : Boolean(auth.list || auth.retrieve)
    },
    {
      text: t("buttons.changeHistory"),
      code: "changeHistory",
      props: {
        type: "info",
        icon: useRenderIcon(FileList),
        link: true
      },
      onClick: ({ row }) => {
        handleShowChangeHistory({ t, api, row });
      },
      tooltip: { content: t("buttons.changeHistory") },
      // 页面在 getDefaultAuths 中声明 changeHistory 且菜单授予
      // changeHistory:<ComponentName> 权限码时显示（用户管理页已开启示范）
      index: -5,
      show: hideChangeHistory ? false : Boolean(auth.changeHistory)
    }
  ];
}
