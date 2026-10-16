import { buildRoleRulesColumns } from "@/views/system/hooks";
import { ref, type Ref } from "vue";
import {
  handleOperation,
  openDialogDrawer,
  type PageColumn
} from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";
import type { UnwrapNestedRefs } from "vue";
import type { userApi } from "@/api/identity/user";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 用户角色/权限授权：授权弹窗列构建（baseColumnsFormat）与授权抽屉提交（handleRoleRules） */
export function useUserRoleRules({
  t,
  api,
  tableRef
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
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
      keepKeys: ["username", "nickname", "roles", "rules"],
      disabledKeys: ["username", "nickname"],
      wideKeys: ["username", "nickname", "phone", "email", "gender"]
    });
  };

  function handleRoleRules(row: RecordType) {
    openDialogDrawer({
      t,
      isAdd: false,
      title: t("systemUser.assignRole", { user: row.username }),
      rawRow: { ...row },
      rawColumns: roleRulesColumns.value,
      rawFormProps: {
        rules: roleRules.value
      },
      saveCallback: ({ formData, done, closeLoading }) => {
        handleOperation({
          t,
          apiReq: api.empower(row.pk as string | number, {
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

  return { roleRules, roleRulesColumns, baseColumnsFormat, handleRoleRules };
}
