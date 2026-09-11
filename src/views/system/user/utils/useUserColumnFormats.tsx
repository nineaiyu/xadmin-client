import { isPhone } from "@pureadmin/utils";
import { buildRoleRulesColumns } from "@/views/system/hooks";
import { statusTagProps, type StatusTagType } from "@/utils/dict";
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
import { buildPasswordValidator } from "./passwordRules";
import type { useI18n } from "vue-i18n";
import type { userApi } from "@/api/system/user";
import type { PasswordRule } from "@/api/auth";

type TFunction = ReturnType<typeof useI18n>["t"];
type SwitchStyle = ReturnType<typeof usePublicHooks>["switchStyle"];

/** 字典色失效时的性别 tag 语义色兜底（1=男 2=女） */
const GENDER_TAG_TYPE: Record<string, StatusTagType> = {
  "0": "primary",
  "1": "primary",
  "2": "danger"
};

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
          // 字典驱动（user_gender）：字典色优先彩色 tag（统一走 statusTagProps，
          // 避免 ElTag 只换背景导致字体色与字典不一致）；无色回退枚举映射（女=2 danger）
          column["cellRenderer"] = ({ row, props }) => {
            const gender = row.gender;
            return (
              <el-tag
                size={props.size}
                {...statusTagProps(gender, GENDER_TAG_TYPE)}
                effect={gender?.color ? undefined : "plain"}
              >
                {gender?.label ?? ""}
              </el-tag>
            );
          };
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
              validator: buildPasswordValidator(t, passwordRules),
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
      beforeSubmit: async ({ formData, formOptions: { isAdd } }) => {
        if (isAdd) {
          formData["password"] = await AesEncrypted(
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
    roleRulesColumns.value = buildRoleRulesColumns(addOrEditColumns.value, {
      keepKeys: ["username", "nickname", "roles", "rules"],
      disabledKeys: ["username", "nickname"],
      wideKeys: ["username", "nickname", "phone", "email", "gender"]
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
    roleRules,
    roleRulesColumns,
    listColumnsFormat,
    addOrEditOptions,
    baseColumnsFormat,
    handleRoleRules
  };
}
