import { deptApi } from "@/api/system/dept";
import { h, reactive, ref, type Ref, shallowRef } from "vue";
import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { buildRoleRulesColumns, usePageAuth } from "@/views/system/hooks";
import DeptPermissionPreview from "../components/DeptPermissionPreview.vue";
import DeptManagersDialog from "../components/DeptManagersDialog.vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { addDrawer } from "@/components/ReDrawer";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import View from "~icons/ri/eye-line";
import Manager from "~icons/ri/shield-keyhole-line";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";
import { handleTree } from "@/utils/tree";
import {
  type PageColumn,
  type PageTableColumn,
  formatPageColumns,
  handleOperation,
  openDialogDrawer,
  type OperationProps,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import Role from "~icons/ri/admin-line";

export function useDept(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(deptApi);

  const auth = usePageAuth(["empower", "preview", "assignManagers"]);

  /** 部门授权预览抽屉（挂载角色 / 数据权限 / 字段权限 / 成员采样；统一走 ReDrawer） */
  const openPreview = (row: DeptRow) => {
    addDrawer({
      title: t("permissionPreview.deptTitle"),
      size: "70%",
      destroyOnClose: true,
      hideFooter: true,
      contentRenderer: () => h(DeptPermissionPreview, { row })
    });
  };

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      user_count: column => {
        column["cellRenderer"] = ({ row }) => {
          // 无「用户列表」权限或人数为 0 时不可跳转：渲染为纯文本，
          // 避免出现可点却无反应（也无提示）的假链接
          const canJump = hasAuth("list:SystemUser") && row.user_count > 0;
          if (!canJump) return <span>{row.user_count}</span>;
          return (
            <el-link onClick={() => onGoDetail(row)}>{row.user_count}</el-link>
          );
        };
      },
      name: column => {
        column["minWidth"] = 200;
        column["align"] = "left";
      }
    });

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        parent: ({ rawRow }: { rawRow?: RecordType }) => {
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
            column._column?.choices ?? [],
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

  const roleRulesColumns = ref<PageColumn[]>([]);
  const roleRules = ref({});
  const baseColumnsFormat = ({
    addOrEditColumns,
    addOrEditRules
  }: {
    addOrEditColumns: Ref<PageColumn[]>;
    addOrEditRules: Ref<RecordType>;
  }) => {
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
          apiReq: api.empower(row.pk as number | string, {
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

  /* ---------------- 管理员任命（ReDialog + DeptManagersDialog） ---------------- */
  /** 弹窗载荷读取口：由内容组件就绪时经 onReady 显式注册（不依赖模板 ref 语义） */
  let managerDialogApi:
    { getPayload: () => Record<string, unknown> | null } | undefined;

  const openManagers = (row: DeptRow) => {
    managerDialogApi = undefined;
    addDialog({
      title: `${t("systemDept.managers")}：${row.name}`,
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      // 行类型中 pk 为可选（框架 row 宽容形态），此处按弹窗契约收窄
      contentRenderer: () =>
        h(DeptManagersDialog, {
          row: { ...row, pk: row.pk as number | string },
          onReady: (api: NonNullable<typeof managerDialogApi>) => {
            managerDialogApi = api;
          }
        }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = managerDialogApi?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        const res = await api
          .assignManagers(row.pk as number | string, payload)
          .catch(error => ({
            code: -1,
            detail: String((error as { detail?: string })?.detail ?? error)
          }));
        if (res.code === SUCCESS_CODE) {
          message(t("systemDept.managerSaveOk"), { type: "success" });
          done();
          tableRef.value.handleGetData();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  // 批量更新：勾选行后统一写入同组字段（字段白名单：启用状态）
  const { batchUpdateButton } = useBatchUpdate({
    t,
    api,
    tableRef,
    fields: [
      {
        key: "is_active",
        label: t("commonLabels.is_active"),
        input_type: "boolean"
      }
    ]
  });
  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [batchUpdateButton]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 360,
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
        text: t("systemDept.managers"),
        code: "assignManagers",
        props: {
          type: "primary",
          icon: useRenderIcon(Manager),
          link: true
        },
        onClick: ({ row }) => {
          openManagers(row);
        },
        show: auth.assignManagers
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
          openPreview(row);
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
    tableBarButtonsProps,
    operationButtonsProps
  };
}
