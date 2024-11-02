import { deptApi } from "@/api/system/dept";
import { getCurrentInstance, reactive, ref, type Ref, shallowRef } from "vue";
import { cloneDeep } from "@pureadmin/utils";
import { useRouter } from "vue-router";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { customRolePermissionOptions } from "@/views/system/hooks";
import { handleTree } from "@/utils/tree";
import {
  type PageColumnList,
  handleOperation,
  openFormDialog,
  type OperationProps,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Role from "@iconify-icons/ri/admin-line";

export function useDept(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(deptApi);

  const auth = reactive({
    empower: false,
    ...getDefaultAuths(getCurrentInstance(), ["empower"])
  });

  const listColumnsFormat = (columns: PageColumnList[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "user_count":
          column["cellRenderer"] = ({ row }) => (
            <el-link onClick={() => onGoDetail(row as any)}>
              {row.user_count}
            </el-link>
          );
          break;
        case "name":
          column["minWidth"] = 200;
          column["align"] = "left";
          break;
      }
    });
    return columns;
  };

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        parent: ({ rawRow }) => {
          return rawRow?.parent?.pk ?? "";
        }
      },
      columns: {
        parent: ({ column }) => {
          column["valueType"] = "cascader";
          column["fieldProps"] = {
            ...column["fieldProps"],
            ...{
              valueOnClear: "",
              props: {
                value: "pk",
                label: "name",
                emitPath: false,
                checkStrictly: true
              }
            }
          };
          column["options"] = handleTree(
            column._column.choices,
            "pk",
            "parent_id"
          );
          return column;
        }
      },
      dialogOptions: {
        closeCallBack: ({ options, args }) => {
          if (!options?.props?.formInline?.pk && args?.command === "sure") {
            tableRef.value?.getPageColumn(false);
          }
        }
      }
    }
  });

  const router = useRouter();

  function onGoDetail(row: any) {
    if (hasAuth("list:SystemUser") && row.user_count && row.pk) {
      router.push({
        name: "SystemUser",
        query: { dept: row.pk }
      });
    }
  }

  const roleRulesColumns = ref([]);
  const roleRules = ref({});
  const baseColumnsFormat = ({ addOrEditColumns, addOrEditRules }) => {
    roleRules.value = addOrEditRules.value;
    roleRulesColumns.value = cloneDeep(addOrEditColumns.value);
    roleRulesColumns.value.forEach(column => {
      if (
        ["name", "code", "roles", "rules", "mode_type"].indexOf(
          column._column.key
        ) === -1
      ) {
        column.hideInForm = true;
      }
      if (["name", "code"].indexOf(column._column.key) > -1) {
        column["fieldProps"]["disabled"] = true;
      }
      if (["roles", "rules"].indexOf(column._column.key) > -1) {
        column.options = customRolePermissionOptions(
          column._column.choices ?? []
        );
      }
    });
    /* "pk", "roles", "rules", "mode_type" 这些字段在编辑和新增隐藏 */
    addOrEditColumns.value.forEach(column => {
      if (
        ["pk", "roles", "rules", "mode_type"].indexOf(column._column.key) > -1
      ) {
        column.hideInForm = true;
      }
    });
  };

  function handleRoleRules(row: any) {
    openFormDialog({
      t,
      isAdd: false,
      title: t("systemDept.assignRole", { dept: row.name }),
      rawRow: { ...row },
      rawColumns: roleRulesColumns.value,
      rawFormProps: {
        rules: roleRules.value
      },
      saveCallback: ({ formData, done, closeLoading }) => {
        handleOperation({
          t,
          apiReq: api.empower(row.pk, {
            roles: formData.roles,
            rules: formData.rules,
            mode_type: formData.mode_type
          }),
          success() {
            done();
            tableRef.value.handleGetData();
          },
          requestEnd() {
            closeLoading();
          }
        });
      }
    });
  }

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 210,
    buttons: [
      {
        text: t("systemDept.assignRoles"),
        code: "empower",
        props: {
          type: "primary",
          icon: useRenderIcon(Role),
          link: true
        },
        onClick: ({ row }) => {
          handleRoleRules(row);
        },
        show: auth.empower
      }
    ]
  });

  return {
    t,
    api,
    auth,
    listColumnsFormat,
    baseColumnsFormat,
    addOrEditOptions,
    operationButtonsProps
  };
}
