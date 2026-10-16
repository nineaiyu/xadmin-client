import { ref, type Ref } from "vue";
import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import { goUserDetail } from "@/views/system/hooks";
import {
  formatPageColumns,
  renderSwitch,
  usePublicHooks,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { noticeReadApi } from "@/api/system/notice";
import type { useI18n } from "vue-i18n";
import type { UnwrapNestedRefs } from "vue";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 行内嵌套字段（点击跳转 SystemUser / SystemNotice） */
type OwnerRow = { owner?: { username?: string; pk?: number | string } };
type NoticeRow = { notice_info?: { pk?: number | string } };

/**
 * 通知接收列表列渲染（自 hook.tsx 抽出）：通知标题（按等级着色 + 跳转详情）、
 * 接收人（跳转用户详情）、已读开关（state 接口 + 权限控制）。
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

  function onGoNoticeDetail(row: NoticeRow) {
    if (
      hasAuth("list:SystemNotice") &&
      row?.notice_info &&
      row.notice_info?.pk
    ) {
      router.push({
        name: "SystemNotice",
        query: { pk: row.notice_info.pk }
      });
    }
  }

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      notice_info: column => {
        column["cellRenderer"] = ({ row }) => (
          <el-link
            type={row.notice_info?.level?.value}
            onClick={() => onGoNoticeDetail(row)}
          >
            {row.notice_info.title}
          </el-link>
        );
      },
      owner: column => {
        column["cellRenderer"] = ({ row }) => (
          <el-link onClick={() => onGoUserDetail(row)}>
            {row.owner?.username ? row.owner?.username : "/"}
          </el-link>
        );
      },
      unread: column => {
        column["cellRenderer"] = renderSwitch({
          t,
          updateApi: api.state,
          switchLoadMap,
          switchStyle,
          field: column.prop as string,
          disabled: () => !auth.state,
          success() {
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
      }
    });

  return { listColumnsFormat };
}
