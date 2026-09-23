import { isPhone } from "@pureadmin/utils";
import { buildRoleRulesColumns } from "@/views/system/hooks";
import { choiceValue, statusTagProps, type StatusTagType } from "@/utils/dict";
import { AesEncrypted } from "@/utils/aes";
import { h, shallowRef, ref, type Ref, type UnwrapNestedRefs } from "vue";
import { ElImage } from "element-plus";
import {
  handleOperation,
  isReadonlyCell,
  openDialogDrawer,
  renderSwitch,
  type usePublicHooks,
  type PageColumn,
  type PageTableColumn,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { handleTree } from "@/utils/tree";
import { buildPasswordValidator } from "./passwordRules";
import type { useI18n } from "vue-i18n";
import type { userApi } from "@/api/system/user";
import type { TagItem } from "@/api/system/tag";
import type { PasswordRule } from "@/api/auth";
import type { RecordType } from "plus-pro-components";

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
  const roleRulesColumns = ref<PageColumn[]>([]);
  const roleRules = ref({});
  // 一步邀请：新建表单中「邀请激活」开关的当前值（驱动密码字段的动态校验与提交）
  const inviteMode = ref(false);

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "avatar":
          column["cellRenderer"] = scope => {
            const src = scope.row[column._column?.key as string];
            return h(ElImage, {
              lazy: true,
              src,
              // 有头像给可访问名；无头像回落的装饰图 alt 置空（读屏器可忽略）
              alt: src ? t("systemUser.avatarAlt") : "",
              class: ["w-[36px]", "h-[36px]", "align-middle"],
              // 回收站只读：不提供点击放大预览
              previewSrcList: isReadonlyCell(scope) ? undefined : [src],
              previewTeleported: true
            });
          };
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
            field: column.prop as string,
            disabled: row => !auth.unblock || !row?.block
          });
          break;
        case "invite_status":
          // 邀请开户：pending = 待接受邀请；accepted = 已激活；空 = 非邀请账号
          // （choices 字段下发 {value,label} 对象，label 优先走服务端 i18n，前端键兜底）
          column["cellRenderer"] = ({ row, props }) => {
            const raw = row.invite_status;
            const status = choiceValue(raw);
            if (!status) return <span>-</span>;
            return (
              <el-tag
                size={props.size}
                type={status === "pending" ? "warning" : "success"}
                effect="plain"
              >
                {raw?.label ??
                  t(
                    status === "pending"
                      ? "systemUser.invitePending"
                      : "systemUser.inviteAccepted"
                  )}
              </el-tag>
            );
          };
          break;
        case "tags":
          // 通用标签：数组字段需页面自渲染（框架对数组只做 String 化）
          // 颜色为自定义色值时 ElTag 只换背景，需补文字色与去边框
          column["cellRenderer"] = ({ row, props }) => {
            const tags = (row.tags ?? []) as TagItem[];
            if (!tags.length) return <span>-</span>;
            return (
              <div class="flex flex-wrap items-center gap-1">
                {tags.map(tag => (
                  <el-tag
                    key={tag.pk}
                    size={props.size}
                    color={tag.color || undefined}
                    style={
                      tag.color ? { border: "none", color: "#fff" } : undefined
                    }
                  >
                    {tag.name}
                  </el-tag>
                ))}
              </div>
            );
          };
          break;
      }
    });
    return columns;
  };

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        dept: ({ rawRow }: { rawRow?: RecordType }) => {
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
        invite: ({ column, isAdd }) => {
          // 一步邀请：新建时可选「邀请激活」——创建后立即发邀请邮件（用户自行设置密码），
          // 免去「先建号（管理员设密码）再点行操作邀请」的两步；编辑场景不展示
          inviteMode.value = false;
          if (!isAdd) {
            column["hideInForm"] = true;
          }
          column["valueType"] = "switch";
          column["fieldProps"] = {
            ...column["fieldProps"],
            onChange: (value: unknown) => {
              inviteMode.value = Boolean(value);
            }
          };
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
            column._column?.choices ?? [],
            "pk",
            "parent_id"
          );
          return column;
        }
      },
      formProps: {
        rules: ({
          rawFormProps: { rules }
        }: {
          rawFormProps: { rules: RecordType };
        }) => {
          // 一步邀请：邀请模式下密码由被邀请人自行设置 → 密码非必填（动态校验）
          rules["password"] = [
            {
              validator: (
                rule: unknown,
                value: string | undefined,
                callback: (error?: Error) => void
              ) => {
                if (inviteMode.value) {
                  callback();
                  return;
                }
                if (!value) {
                  callback(new Error(t("systemUser.passwordRequired")));
                  return;
                }
                buildPasswordValidator(t, passwordRules)(rule, value, callback);
              },
              trigger: "blur"
            }
          ];
          rules["phone"] = [
            {
              validator: (
                _rule: unknown,
                value: string | undefined,
                callback: (error?: Error) => void
              ) => {
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
        if (isAdd && formData.invite) {
          // 邀请模式：不提交密码（服务端置不可用，由被邀请人从邮件链接自行设置）
          delete formData["password"];
          return formData;
        }
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

  return {
    roleRules,
    roleRulesColumns,
    listColumnsFormat,
    addOrEditOptions,
    baseColumnsFormat,
    handleRoleRules
  };
}
