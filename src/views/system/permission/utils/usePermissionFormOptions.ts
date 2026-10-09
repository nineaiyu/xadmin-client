import { shallowRef, type Ref } from "vue";
import type { RecordType } from "plus-pro-components";
import type { RePlusPageProps } from "@/components/RePlusPage";
import { buildPermissionFormColumns } from "./permissionFormColumns";
import type { FieldLookupItem } from "../components/utils/types";
import type { MenuScopeRow } from "../components/utils/menuScope";
import type { TreeResult } from "@/utils/tree";

type LookupRows = Ref<TreeResult<RecordType>[]>;

/**
 * 数据权限新增/编辑弹层装配。
 * 自 useDataPermission 拆出（行为不变）：列解析器（生效范围/且或模式/规则编辑器）
 * 见 permissionFormColumns.ts，本文件只做依赖注入与弹层形态声明。
 */
export function usePermissionFormOptions({
  fieldLookupsData,
  fieldLookupsRole,
  valuesData,
  matchTexts,
  menuRows,
  menuContextOptions
}: {
  fieldLookupsData: LookupRows;
  fieldLookupsRole: LookupRows;
  valuesData: Ref<FieldLookupItem[]>;
  matchTexts: Ref<Record<string, string>>;
  menuRows: Ref<MenuScopeRow[]>;
  menuContextOptions: Ref<{ value: string; label: string }[]>;
}) {
  const { row, columns } = buildPermissionFormColumns({
    fieldLookupsData,
    fieldLookupsRole,
    valuesData,
    matchTexts,
    menuRows,
    menuContextOptions
  });

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row,
      columns,
      // 新增与编辑共用右侧抽屉：规则编辑器 + 试算面板需要宽于默认弹窗的内容区
      mode: "drawer",
      dialogDrawerOptions: {
        width: "900px"
      }
    }
  });

  return {
    addOrEditOptions
  };
}
