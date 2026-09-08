import { cloneDeep, isPhone } from "@pureadmin/utils";
import { customRolePermissionOptions } from "@/views/system/hooks";
import { AesEncrypted } from "@/utils/aes";
import { h, shallowRef, ref, type Ref, type UnwrapNestedRefs } from "vue";
import { ElImage } from "element-plus";
import {
  handleOperation,
  openDialogDrawer,
  renderSwitch,
  type usePublicHooks,
  type PageTableColumn,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { handleTree } from "@/utils/tree";
import { passwordRulesCheck } from "@/utils";
import type { useI18n } from "vue-i18n";
import type { userApi } from "@/api/system/user";
import type { PasswordRule } from "@/api/auth";

type TFunction = ReturnType<typeof useI18n>["t"];
type SwitchStyle = ReturnType<typeof usePublicHooks>["switchStyle"];

/** 用户视图列渲染与表单格式化：单元格渲染器、新增/编辑表单选项、授权弹窗列 */
export function useUserColumnFormats({
  t,
  api,
  auth,
  switchLoadMap,
  switchStyle,
  passwordRules,
  tableRef
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof userApi>;
  auth: { unblock?: boolean };
  switchLoadMap: Ref<Record<string, unknown>>;
  switchStyle: SwitchStyle;
  passwordRules: { value: PasswordRule[] };
  tableRef: Ref;
}) {
  const roleRulesColumns = ref([]);
  const roleRules = ref({});

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "avatar":
          column["cellRenderer"] = ({ row }) =>
            h(ElImage, {
              lazy: true,
              src: row[column._column?.key],
              // 无头像用户 alt 为空串（装饰图）；非空才用图片地址，避免 alt 缺失
              alt: row[column._column?.key] || "用户头像",
              class: ["w-[36px]", "h-[36px]", "align-middle"],
              previewSrcList: [row[column._column?.key]],
              previewTeleported: true
            });
          break;
        case "gender":
          column["cellRenderer"] = ({ row, props }) => (
            <el-tag
              size={props.size}
              type={row.gender === 2 ? "danger" : "primary"}
              effect="plain"
            >
              {row.gender?.label ?? ""}
            </el-tag>
          );
          break;
        case "block":
          column["cellRenderer"] = renderSwitch({
            t,
            updateApi: api.unblock,
            switchLoadMap,
            switchStyle,
            field: column.prop,
            disabled: row => !auth.unblock || !row.block
          });
          break;
      }
    });
    return columns;
  };

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        dept: ({ rawRow }) => {
          return rawRow?.dept?.pk ?? "";
        }
      },
      columns: {
        password: ({ column, isAdd }) => {
          if (!isAdd) {
            column["hideInForm"] = true;
          }
          return column;
        },
        dept: ({ column }) => {
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
      formProps: {
        rules: ({ rawFormProps: { rules } }) => {
          rules["password"] = [
            {
              required: true,
              validator: (rule, value, callback) => {
                const { result, msg } = passwordRulesCheck(
                  value,
                  passwordRules.value,
                  t
                );
                if (result) {
                  callback();
                } else {
                  callback(new Error(msg));
                }
              },
              trigger: "blur"
            }
          ];
          rules["phone"] = [
            {
              validator: (rule, value, callback) => {
                if (value === "" || !value) {
                  callback();
                } else if (!isPhone(value)) {
                  callback(new Error(t("login.phoneCorrectReg")));
                } else {
                  callback();
                }
              },
              trigger: "blur"
            }
          ];
          return rules;
        }
      },
      beforeSubmit: ({ formData, formOptions: { isAdd } }) => {
        if (isAdd) {
          formData["password"] = AesEncrypted(
            formData.username,
            formData.password
          );
        }
        return formData;
      }
    }
  });

  const baseColumnsFormat = ({ addOrEditColumns, addOrEditRules }) => {
    roleRules.value = addOrEditRules.value;
    roleRulesColumns.value = cloneDeep(addOrEditColumns.value);
    roleRulesColumns.value.forEach(column => {
      if (
        ["username", "nickname", "roles", "rules", "mode_type"].indexOf(
          column._column.key
        ) === -1
      ) {
        column.hideInForm = true;
      }
      if (["username", "nickname"].indexOf(column._column.key) > -1) {
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
      if (
        ["username", "nickname", "phone", "email", "gender"].indexOf(
          column._column.key
        ) > -1
      ) {
        column["colProps"] = { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 };
      }
    });
  };

  function handleRoleRules(row: { username: string; [key: string]: unknown }) {
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

  return {
    roleRules,
    roleRulesColumns,
    listColumnsFormat,
    addOrEditOptions,
    baseColumnsFormat,
    handleRoleRules
  };
}
