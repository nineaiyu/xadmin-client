import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { reactive, type Ref, shallowRef } from "vue";
import { userConfigApi } from "@/api/system/config/user";

import {
  type CRUDColumn,
  handleOperation,
  type OperationProps,
  type RePlusPageProps
} from "@/components/RePlusCRUD";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import CircleClose from "@iconify-icons/ep/circle-close";

export function useUserConfig(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(userConfigApi);

  const auth = reactive({
    list: hasAuth("list:systemUserConfig"),
    create: hasAuth("create:systemUserConfig"),
    delete: hasAuth("delete:systemUserConfig"),
    update: hasAuth("update:systemUserConfig"),
    invalid: hasAuth("invalid:systemUserConfig"),
    import: hasAuth("import:systemUserConfig"),
    export: hasAuth("export:systemUserConfig"),
    batchDelete: hasAuth("batchDelete:systemUserConfig")
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

  const listColumnsFormat = (columns: CRUDColumn[]) => {
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
    if (hasGlobalAuth("list:systemUser") && row.owner && row.owner?.pk) {
      router.push({
        name: "SystemUser",
        query: { pk: row.owner.pk }
      });
    }
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 260,
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
            row,
            apiUrl: api.invalid,
            success() {
              tableRef.value.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        show: auth.invalid
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
