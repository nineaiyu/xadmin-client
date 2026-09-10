import { deptApi } from "@/api/system/dept";
import { getCurrentInstance, reactive, ref, type Ref, shallowRef } from "vue";
import { useRouter } from "vue-router";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { buildRoleRulesColumns } from "@/views/system/hooks";
import type DeptPermissionPreview from "../components/DeptPermissionPreview.vue";
import View from "~icons/ri/eye-line";
import { handleTree } from "@/utils/tree";
import {
  type PageTableColumn,
  handleOperation,
  openDialogDrawer,
  type OperationProps,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Role from "~icons/ri/admin-line";

export function useDept(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(deptApi);

  const auth = reactive({
    empower: false,
    preview: false,
    ...getDefaultAuths(getCurrentInstance(), ["empower", "preview"])
  });

  /** 部门授权预览抽屉（挂载角色 / 数据权限 / 字段权限 / 成员采样） */
  const previewRef = ref<InstanceType<typeof DeptPermissionPreview>>();

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "user_count":
          column["cellRenderer"] = ({ row }) => (
            <el-link onClick={() => onGoDetail(row)}>{row.user_count}</el-link>
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
      dialogDrawerOptions: {
        closeCallBack: ({ options, args }) => {
          const formInline = options?.props?.formInline as
            { pk?: number | string } | undefined;
          if (!formInline?.pk && args?.command === "sure") {
            tableRef.value?.getPageColumn(false);
          }
        }
      }
    }
  });

  const router = useRouter();

  /** 部门行：跳转详情与授权弹层所需字段 */
  type DeptRow = {
    name?: string;
    user_count?: number;
    pk?: number | string;
  } & Record<string, unknown>;

  function onGoDetail(row: DeptRow) {
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
    roleRulesColumns.value = buildRoleRulesColumns(addOrEditColumns.value, {
      keepKeys: ["name", "code", "roles", "rules"],
      disabledKeys: ["name", "code"]
    });
  };

  function handleRoleRules(row: DeptRow) {
    openDialogDrawer({
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
            rules: formData.rules
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
    width: 280,
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
      },
      {
        text: t("systemDept.preview"),
        code: "preview",
        props: {
          type: "primary",
          icon: useRenderIcon(View),
          link: true
        },
        onClick: ({ row }) => {
          previewRef.value?.open(row);
        },
        show: auth.preview
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
    operationButtonsProps,
    previewRef
  };
}
