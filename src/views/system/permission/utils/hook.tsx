import { getCurrentInstance, h, reactive, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { getDefaultAuths } from "@/router/utils";
import { dataPermissionApi } from "@/api/system/permission";
import { ModeChoices } from "@/views/system/constants";
import {
  formatPageColumns,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import { parseFormMode } from "../components/utils/trial";
import { usePermissionLookups } from "./usePermissionLookups";
import { usePermissionFormOptions } from "./usePermissionFormOptions";

export function useDataPermission() {
  const { t } = useI18n();

  const api = reactive(dataPermissionApi);

  const auth = reactive({
    ...getDefaultAuths(getCurrentInstance())
  });

  // 注册表数据源：规则字段/值选项/匹配符文案/菜单行
  const lookups = usePermissionLookups();

  // 新增/编辑弹层：生效范围树 + 模式选择 + 规则编辑器
  const { addOrEditOptions } = usePermissionFormOptions({ ...lookups });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 160,
    buttons: [{ code: "detail", show: false }]
  });

  /** 「且/或」模式标签（单条规则时服务端统一按或模式保存，标注避免误读） */
  const modeTag = (modeType: unknown, ruleCount: number) => {
    if (ruleCount < 2) {
      return h(ElTag, { effect: "plain", size: "small", type: "info" }, () =>
        t("systemPermission.list.modeSingle")
      );
    }
    const mode = parseFormMode(modeType);
    const isAnd = mode === ModeChoices.AND;
    return h(
      ElTag,
      { effect: "plain", size: "small", type: isAnd ? "warning" : "primary" },
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
      return h(ElTag, { effect: "plain", size: "small", type: "info" }, () =>
        t("systemPermission.list.scopeAll")
      );
    }
    return h(ElTag, { effect: "plain", size: "small", type: "success" }, () =>
      t("systemPermission.list.scopeApis", { count })
    );
  };

  // 统计列共用渲染（user_count / dept_count 同口径；取值键随列而定）
  const formatCountColumn = (column: PageTableColumn) => {
    column["width"] = 100;
    column["cellRenderer"] = ({ row }) =>
      String(row[column._column?.key as string] ?? 0);
  };

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
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

  return {
    api,
    auth,
    addOrEditOptions,
    listColumnsFormat,
    operationButtonsProps
  };
}
