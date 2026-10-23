import { h, ref, type Ref } from "vue";
import { useRouter } from "vue-router";
import { ElLink, ElTag } from "element-plus";
import { goUserDetail } from "@/views/system/hooks";
import {
  formatPageColumns,
  renderSwitch,
  usePublicHooks,
  type PageTableColumn
} from "@/components/RePlusPage";
import { openNoticeReadDetail } from "./noticeReadDetail";
import { isNoticeFamilyRow, type NoticeReadRow } from "./noticeReadRules";
import type { noticeReadApi } from "@/api/system/notice";
import type { useI18n } from "vue-i18n";
import type { UnwrapNestedRefs } from "vue";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 行内嵌套字段（点击跳转 SystemUser） */
type OwnerRow = { owner?: { username?: string; pk?: number | string } };

/**
 * 通知接收列表列渲染（自 hook.tsx 抽出）：通知标题（按等级着色 + 打开详情）、
 * 接收人（跳转用户详情）、已读列（用户族开关 / 公告族只读，移除走操作列）。
 */
export function useNoticeReadColumns({
  t,
  api,
  auth,
  tableRef
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof noticeReadApi>;
  auth: { state?: boolean };
  tableRef: Ref;
}) {
  const router = useRouter();
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();

  function onGoUserDetail(row: OwnerRow) {
    goUserDetail(router, row.owner?.pk);
  }

  /**
   * 打开公告详情弹窗。
   *
   * 不再跨页 push `SystemNotice?pk=`：公告管理页只消费 `notice_user` 参数，
   * `pk` 会被合并成列表筛选条件，落不到任何详情；行内 `notice_info` 已含
   * 标题/正文/格式，直接复用接收列表自己的详情弹窗（也不再依赖公告管理权限）。
   */
  function onOpenNoticeDetail(row: NoticeReadRow) {
    if (!row?.notice_info?.pk) return;
    openNoticeReadDetail({ t, row });
  }

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      notice_info: column => {
        column["cellRenderer"] = ({ row }) =>
          h(
            ElLink,
            {
              type: row.notice_info?.level?.value,
              onClick: () => onOpenNoticeDetail(row)
            },
            () => row.notice_info.title
          );
      },
      owner: column => {
        column["cellRenderer"] = ({ row }) =>
          h(ElLink, { onClick: () => onGoUserDetail(row) }, () =>
            row.owner?.username ? row.owner?.username : "/"
          );
      },
      unread: column => {
        const renderUnreadSwitch = renderSwitch({
          t,
          updateApi: api.state,
          switchLoadMap,
          switchStyle,
          field: column.prop as string,
          disabled: () => !auth.state,
          success() {
            tableRef.value.handleGetData();
          },
          failed() {
            tableRef.value.handleGetData();
          },
          actionMap: {
            true: t("labels.read"),
            false: t("labels.unread")
          },
          activeMap: {
            false: true,
            true: false
          }
        });
        column["cellRenderer"] = scope => {
          // 公告族的 state 语义是「从我的列表移除」，不是可回写的已读开关：
          // 只读展示状态，移除由操作列的显式确认动作承担，避免误删接收记录
          if (isNoticeFamilyRow(scope.row)) {
            return h(
              ElTag,
              {
                size: "small",
                effect: "plain",
                type: scope.row.unread ? "info" : "success"
              },
              () => (scope.row.unread ? t("labels.unread") : t("labels.read"))
            );
          }
          return renderUnreadSwitch(scope);
        };
      }
    });

  return { listColumnsFormat };
}
