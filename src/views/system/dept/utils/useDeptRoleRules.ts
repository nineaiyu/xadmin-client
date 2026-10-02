import { ref, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { buildRoleRulesColumns } from "@/views/system/hooks";
import { handleOperation, openDialogDrawer } from "@/components/RePlusPage";
import type { PageColumn } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import type { deptApi } from "@/api/system/dept";
import type { DeptRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];
type DeptApiLike = Pick<typeof deptApi, "empower">;

/**
 * 部门角色/数据权限授权：编辑弹层列裁剪状态与「分配角色」弹层动作。
 * 自 useDept 拆出（行为不变）：baseColumnsFormat 负责装载裁剪列，handleRoleRules 负责提交。
 */
export function useDeptRoleRules({
  t,
  api,
  tableRef
}: {
  t: TFunction;
  api: DeptApiLike;
  tableRef: Ref;
}) {
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

  return {
    baseColumnsFormat,
    handleRoleRules
  };
}
