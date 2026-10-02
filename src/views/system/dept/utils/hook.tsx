import { deptApi } from "@/api/system/dept";
import { h, reactive, shallowRef, type Ref } from "vue";
import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { usePageAuth } from "@/router/utils";
import DeptPermissionPreview from "../components/DeptPermissionPreview.vue";
import { addDrawer } from "@/components/ReDrawer";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";
import {
  type PageTableColumn,
  formatPageColumns,
  type OperationProps,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import Role from "~icons/ri/admin-line";
import View from "~icons/ri/eye-line";
import Manager from "~icons/ri/shield-keyhole-line";
import { useDeptRoleRules } from "./useDeptRoleRules";
import { useDeptManagers } from "./useDeptManagers";
import { applyDeptParentColumn, deptParentFormValue } from "./deptParentColumn";
import type { DeptRow } from "./types";

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
        parent: ({ rawRow }: { rawRow?: RecordType }) =>
          deptParentFormValue(rawRow)
      },
      columns: {
        parent: ({ column }) => applyDeptParentColumn(column)
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

  function onGoDetail(row: DeptRow) {
    if (hasAuth("list:SystemUser") && row.user_count && row.pk) {
      router.push({
        name: "SystemUser",
        query: { dept: row.pk }
      });
    }
  }

  // 角色授权与管理员任命弹层（列裁剪状态 + 弹窗动作）
  const { baseColumnsFormat, handleRoleRules } = useDeptRoleRules({
    t,
    api,
    tableRef
  });
  const { openManagers } = useDeptManagers({ t, api, tableRef });

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
