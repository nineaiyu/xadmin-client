import { useI18n } from "vue-i18n";
import { userOnlineApi } from "@/api/system/online";
import { useRouter } from "vue-router";
import { usePageAuth } from "@/router/utils";
import { goUserDetail } from "@/views/system/hooks";
import { reactive, shallowRef, type Ref } from "vue";
import {
  handleOperation,
  type PageTableColumn,
  type OperationProps,
  formatPageColumns
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import Logout from "~icons/ri/logout-circle-r-line";
import CloseCircle from "~icons/ep/circle-close";

/** 在线会话行（按钮/列渲染使用的字段） */
type OnlineRow = {
  pk?: string | number;
  creator?: { username?: string; pk?: number | string };
};

export function useUserOnline(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(userOnlineApi);

  const auth = usePageAuth(["forceLogout", "batchForceLogout"]);

  const router = useRouter();
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 240,
    buttons: [
      {
        text: t("systemUser.logout"),
        code: "delete",
        props: (row, button) => {
          return {
            ...button?._?.props,
            icon: useRenderIcon(Logout)
          };
        },
        update: true,
        // 保留内置「删除」按钮的排序位（-20）：show 返回布尔会让 Number(true)=1
        // 覆盖默认索引，按钮被排到「详情」（-10）之后，与全站顺序不一致
        index: -20,
        show: auth.destroy
      },
      {
        text: t("systemOnline.forceLogout"),
        code: "forceLogout",
        confirm: {
          title: row =>
            t("systemOnline.forceLogoutConfirm", {
              name: row.creator?.username ?? row.creator?.pk
            })
        },
        props: {
          type: "danger",
          icon: useRenderIcon(CloseCircle),
          link: true
        },
        onClick: ({ row, loading }) => {
          // detail pk 必须是用户主键（踢该用户全部会话）；
          // row.pk 是会话行主键（UserSession UUID），语义不同，不能回退兜底，creator 缺失时明确报错
          const userPk = row?.creator?.pk;
          if (userPk == null) {
            message(t("systemOnline.forceLogoutNoUser"), { type: "warning" });
            return;
          }
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.forceLogout(userPk),
            success() {
              tableRef.value?.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        index: 5,
        show: auth.forceLogout
      }
    ]
  });

  /** 工具栏批量强制下线（作用于勾选行，按用户去重） */
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("systemOnline.batchForceLogout"),
        code: "batchForceLogout",
        confirm: {
          title: t("systemOnline.batchForceLogoutConfirm")
        },
        props: {
          type: "danger",
          icon: useRenderIcon(CloseCircle),
          plain: true
        },
        onClick: ({ loading }) => {
          const pks = tableRef.value?.getSelectPks("pk") ?? [];
          if (!pks.length) {
            message(t("results.noSelectedData"), { type: "error" });
            return;
          }
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.batchForceLogout(pks),
            success() {
              tableRef.value?.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.batchForceLogout
      }
    ]
  });

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      creator: column => {
        column["cellRenderer"] = ({ row }) => (
          <el-link onClick={() => onGoDetail(row)}>
            {row.creator?.username ? row.creator?.username : "/"}
          </el-link>
        );
      }
    });

  /** 行内 `creator` 嵌套字段（点击跳转 SystemUser 详情） */
  function onGoDetail(row: OnlineRow) {
    goUserDetail(router, row?.creator?.pk);
  }

  return {
    api,
    auth,
    listColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
