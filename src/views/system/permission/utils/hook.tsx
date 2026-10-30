import { h, shallowRef, type ComputedRef } from "vue";
import { ElTag } from "element-plus";
import { dataPermissionApi } from "@/api/system/permission";
import { ModeChoices } from "@/views/system/constants";
import {
  defineListPage,
  formatPageColumns,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import { parseFormMode } from "../components/utils/trial";
import { usePermissionLookups } from "./usePermissionLookups";
import { usePermissionLookupGuard } from "./usePermissionLookupGuard";
import { usePermissionFormOptions } from "./usePermissionFormOptions";
import { usePermissionTrialAction } from "./usePermissionTrialAction";

export function useDataPermission() {
  // 注册表数据源：规则字段/值选项/匹配符文案/菜单行
  const lookups = usePermissionLookups();
  let lookupAlert: ComputedRef<string> | undefined;

  // 统计列共用渲染（user_count / dept_count 同口径；取值键随列而定）
  const formatCountColumn = (column: PageTableColumn) => {
    column["width"] = 100;
    column["cellRenderer"] = ({ row }) =>
      String(row[column._column?.key as string] ?? 0);
  };

  const page = defineListPage({
    api: dataPermissionApi,
    localeName: "systemPermission",
    columns: ({ t, columns }) => {
      /** 「且/或」模式标签（单条规则时服务端统一按或模式保存，标注避免误读） */
      const modeTag = (modeType: unknown, ruleCount: number) => {
        if (ruleCount < 2) {
          return h(
            ElTag,
            { effect: "plain", size: "small", type: "info" },
            () => t("systemPermission.list.modeSingle")
          );
        }
        const mode = parseFormMode(modeType);
        const isAnd = mode === ModeChoices.AND;
        return h(
          ElTag,
          {
            effect: "plain",
            size: "small",
            type: isAnd ? "warning" : "primary"
          },
          () =>
            isAnd
              ? t("systemPermission.modeAndShort")
              : t("systemPermission.modeOrShort")
        );
      };

      /** 生效范围标签：未绑定菜单 = 通用（全部接口生效） */
      const scopeTag = (menuCount: unknown) => {
        const count = Number(menuCount ?? 0);
        if (!count) {
          return h(
            ElTag,
            { effect: "plain", size: "small", type: "info" },
            () => t("systemPermission.list.scopeAll")
          );
        }
        return h(
          ElTag,
          { effect: "plain", size: "small", type: "success" },
          () => t("systemPermission.list.scopeApis", { count })
        );
      };
      return formatPageColumns(columns, {
        name: column => {
          column["minWidth"] = 180;
        },
        mode_type: column => {
          column["width"] = 110;
          column["cellRenderer"] = ({ row }) =>
            modeTag(row.mode_type, Number(row.rule_count ?? 0));
        },
        // 统计列的表头文案走 `systemPermission.<字段名>` 词条（rule_count / menu_count /
        // user_count / dept_count），与框架 formatPublicLabels 的口径一致
        rule_count: column => {
          column["width"] = 90;
          column["cellRenderer"] = ({ row }) => String(row.rule_count ?? 0);
        },
        menu_count: column => {
          column["minWidth"] = 150;
          column["cellRenderer"] = ({ row }) => scopeTag(row.menu_count);
        },
        user_count: formatCountColumn,
        dept_count: formatCountColumn,
        created_time: column => {
          column["width"] = 170;
        }
      });
    },
    formOptions: ({ auth }) => {
      // 依赖不可用时禁用新增/编辑并给出可读原因（缺权限点 / 加载失败）
      lookupAlert = usePermissionLookupGuard(lookups, auth).lookupAlert;
      // 新增/编辑弹层：生效范围树 + 模式选择 + 规则编辑器
      return usePermissionFormOptions({ ...lookups }).addOrEditOptions;
    },
    buttons: () => {
      const { trialButton } = usePermissionTrialAction(lookups);

      return {
        operationButtonsProps: shallowRef<OperationProps>({
          width: 180,
          buttons: [trialButton, { code: "detail", show: false }]
        })
      };
    }
  });

  return { ...page, lookupAlert };
}
