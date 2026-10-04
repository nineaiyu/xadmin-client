import { deptApi } from "@/api/system/dept";
import { h, reactive, shallowRef, type Ref } from "vue";
import { useRouter } from "vue-router";
import { hasAuth, usePageAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import {
  handleShowChangeHistory,
  type PageTableColumn,
  formatPageColumns,
  type OperationProps,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { addDrawer } from "@/components/ReDrawer";
import {
  PanelProfile,
  ReActionPanel,
  bindRowGroups,
  openManageDrawer
} from "@/components/ReActionPanel";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import Setting from "~icons/ri/settings-3-line";
import DeptPermissionPreview from "../components/DeptPermissionPreview.vue";
import { useDeptRoleRules } from "./useDeptRoleRules";
import { useDeptManagers } from "./useDeptManagers";
import { applyDeptParentColumn, deptParentFormValue } from "./deptParentColumn";
import { buildDeptActionGroups } from "./deptActions";
import { buildDeptMetaItems, buildDeptProfileData } from "./deptPanel";
import { useBatchUpdate } from "@/views/system/components/useBatchUpdate";
import type { DeptRow } from "./types";

export function useDept(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(deptApi);

  const auth = usePageAuth([
    "empower",
    "preview",
    "assignManagers",
    "changeHistory"
  ]);

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

  /**
   * 部门抽屉：行内「管理」入口与抽屉内动作清单共用。
   * 动作执行前先收起抽屉再打开二级弹层（避免抽屉与弹窗叠加、焦点归属混乱），
   * 分组与显隐由 buildDeptActionGroups 统一裁决，面板渲染走 ReActionPanel
   * 通用模板（资料卡数据与基础信息由 deptPanel 从行快照构建）。
   */
  function openDeptPanel(row: DeptRow) {
    openManageDrawer({
      title: t("systemDept.manageDept", { dept: row.name }),
      render: ({ withClosed }) =>
        h(
          ReActionPanel,
          {
            metaItems: buildDeptMetaItems(row, t),
            groups: bindRowGroups(
              buildDeptActionGroups({
                t,
                auth,
                flags: {
                  viewMembers: hasAuth("list:SystemUser")
                },
                handlers: {
                  assignRoles: withClosed(handleRoleRules),
                  assignManagers: withClosed(openManagers),
                  preview: withClosed(openPreview),
                  viewMembers: withClosed(onGoDetail),
                  changeHistory: withClosed(target =>
                    handleShowChangeHistory({ t, api, row: target })
                  )
                }
              }),
              row
            )
          },
          {
            profile: () =>
              h(PanelProfile, { profile: buildDeptProfileData(row, t) })
          }
        )
    });
  }

  const operationButtonsProps = shallowRef<OperationProps>({
    // 列宽与「编辑/删除/管理」三个按钮的实际占用一致（表格固定列对齐按此收敛）
    width: 260,
    // 默认「查看 / 变更历史」入口收敛进抽屉，操作列保持三个动作
    hideDetail: true,
    hideChangeHistory: true,
    buttons: [
      {
        text: t("systemDept.manage"),
        code: "manage",
        props: {
          type: "primary",
          icon: useRenderIcon(Setting),
          link: true
        },
        onClick: ({ row }) => {
          openDeptPanel(row);
        },
        show: true
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
    operationButtonsProps,
    openDeptPanel
  };
}
