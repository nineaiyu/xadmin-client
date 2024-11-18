import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { getCurrentInstance, reactive, type Ref, shallowRef } from "vue";
import { userConfigApi } from "@/api/system/config/user";
import {
  type PageTableColumn,
  handleOperation,
  type OperationProps,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import CircleClose from "@iconify-icons/ep/circle-close";

export function useUserConfig(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(userConfigApi);

  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance()),
    invalid: hasAuth("invalid:UserConfig")
  });

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        config_user: ({ rawRow }) => {
          return rawRow?.owner ? [rawRow?.owner] : [];
        }
      },
      columns: {
        config_user: ({ column, isAdd }) => {
          if (!isAdd) {
            column["fieldProps"]["disabled"] = true;
          }
          return column;
        }
      }
    }
  });

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "owner":
          column["cellRenderer"] = ({ row }) => (
            <el-link onClick={() => onGoUserDetail(row as any)}>
              {row.owner?.username ? row.owner?.username : "/"}
            </el-link>
          );
          break;
      }
    });
    return columns;
  };

  const router = useRouter();

  const onGoUserDetail = (row: any) => {
    if (hasAuth("list:SystemUser") && row.owner && row.owner?.pk) {
      router.push({
        name: "SystemUser",
        query: { pk: row.owner.pk }
      });
    }
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 250,
    buttons: [
      {
        text: t("configUser.invalidCache"),
        code: "invalid",
        confirm: { title: t("configUser.confirmInvalid") },
        props: {
          type: "danger",
          icon: useRenderIcon(CircleClose),
          link: true
        },
        onClick: ({ row, loading }) => {
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.invalid(row?.pk ?? row?.id),
            success() {
              tableRef.value.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.invalid && 3
      },
      {
        code: "detail",
        show: false
      }
    ]
  });

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps
  };
}
