import { useI18n } from "vue-i18n";
import { loginLogApi } from "@/api/system/logs/login";
import { useRouter } from "vue-router";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { getCurrentInstance, reactive, shallowRef } from "vue";
import { usePublicHooks } from "@/views/system/hooks";
import {
  type PageTableColumn,
  type OperationProps,
  renderBooleanTag,
  handleOperation
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Logout from "~icons/ri/logout-circle-r-line";

export function useLoginLog(tableRef) {
  const { t } = useI18n();
  const api = reactive(loginLogApi);

  const auth = reactive({
    logout: false,
    ...getDefaultAuths(getCurrentInstance(), ["logout"])
  });

  const router = useRouter();
  const { tagStyle } = usePublicHooks();

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 180,
    buttons: [
      {
        text: t("systemUser.logout"),
        code: "logout",
        props: (row, button) => {
          const disabled = row?.online !== true;
          return {
            ...(button?._?.props ?? {
              icon: useRenderIcon(Logout),
              plain: true,
              link: true
            }), // button?._ 这个表示之前老的按钮信息
            ...{ disabled, type: disabled ? "default" : "danger" }
          };
        },
        onClick: ({ row }) => {
          handleOperation({
            t,
            apiReq: api.logout(row.pk, {}),
            success() {
              tableRef.value.handleGetData();
            }
          });
        },
        show: auth.logout
      }
    ]
  });
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "creator":
          column["cellRenderer"] = ({ row }) => (
            <el-link onClick={() => onGoDetail(row as any)}>
              {row.creator?.username ? row.creator?.username : "/"}
            </el-link>
          );
          break;
        case "status":
          column["cellRenderer"] = renderBooleanTag({
            t,
            tagStyle,
            field: column.prop,
            actionMap: { true: t("labels.success"), false: t("labels.failed") }
          });
          break;
        case "online":
          column["cellRenderer"] = renderBooleanTag({
            t,
            tagStyle,
            field: column.prop,
            actionMap: {
              true: t("labels.online"),
              false: t("labels.offline"),
              "-1": "/"
            }
          });
          break;
      }
    });
    return columns;
  };

  function onGoDetail(row: any) {
    if (hasAuth("list:SystemUser") && row?.creator && row?.creator?.pk) {
      router.push({
        name: "SystemUser",
        query: { pk: row.creator.pk }
      });
    }
  }

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps
  };
}
