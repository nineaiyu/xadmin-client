import "./reset.css";
import { message } from "@/utils/message";
import { zxcvbn } from "@zxcvbn-ts/core";
import { userApi } from "@/api/system/user";
import { ElForm, ElFormItem, ElImage, ElInput, ElProgress } from "element-plus";
import {
  getCurrentInstance,
  h,
  onMounted,
  reactive,
  ref,
  type Ref,
  shallowRef,
  watch
} from "vue";
import { addDialog } from "@/components/ReDialog";
import croppingUpload from "@/components/RePictureUpload";
import { roleApi } from "@/api/system/role";
import {
  cloneDeep,
  createFormData,
  deviceDetection,
  isAllEmpty,
  isPhone
} from "@pureadmin/utils";
import { useRouter } from "vue-router";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { handleTree } from "@/utils/tree";
import { deptApi } from "@/api/system/dept";
import { dataPermissionApi } from "@/api/system/permission";
import { customRolePermissionOptions, picturePng } from "@/views/system/hooks";
import { AesEncrypted } from "@/utils/aes";
import {
  handleOperation,
  openDialogDrawer,
  type OperationProps,
  renderSwitch,
  type RePlusPageProps,
  usePublicHooks,
  type PageTableColumn
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Role from "~icons/ri/admin-line";
import Avatar from "~icons/ri/user-3-fill";
import Password from "~icons/ri/lock-password-line";
import Message from "~icons/ri/message-fill";
import Logout from "~icons/ri/logout-circle-r-line";

import { rulesPasswordApi } from "@/api/auth";
import { passwordRulesCheck } from "@/utils";

export function useUser(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(userApi);

  const auth = reactive({
    unblock: false,
    empower: false,
    logout: false,
    resetPassword: false,
    ...getDefaultAuths(getCurrentInstance(), [
      "resetPassword",
      "empower",
      "logout",
      "unblock"
    ])
  });
  const cropRef = ref();
  const router = useRouter();
  const treeData = ref([]);
  const treeLoading = ref(true);

  const rolesOptions = ref([]);
  const rulesOptions = ref([]);

  const selectedNum = ref(0);
  const manySelectData = ref([]);
  const avatarInfo = ref();
  const ruleFormRef = ref();
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  // reset password
  const pwdForm = reactive({
    newPwd: ""
  });
  const pwdProgress = [
    { color: "#e74242", text: t("password.veryWeak") },
    { color: "#EFBD47", text: t("password.weak") },
    { color: "#ffa500", text: t("password.average") },
    { color: "#1bbf1b", text: t("password.strong") },
    { color: "#008000", text: t("password.veryStrong") }
  ];
  // 当前密码强度（0-4）
  const curScore = ref();

  function goNotice() {
    const users = [];
    manySelectData.value.forEach(user => {
      users.push({
        pk: user.pk,
        username: user.username
      });
    });
    router.push({
      name: "SystemNotice",
      query: { notice_user: JSON.stringify(users) }
    });
  }

  /** 上传头像 */
  function handleUpload(row) {
    addDialog({
      title: t("systemUser.updateAvatar", { user: row.username }),
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      closeOnClickModal: false,
      contentRenderer: () =>
        h(croppingUpload, {
          imgSrc: picturePng(row?.avatar) ?? "",
          onCropper: info => (avatarInfo.value = info),
          circled: true,
          quality: 1,
          ref: cropRef,
          canvasOption: { width: 512, height: 512 }
        }),
      beforeSure: (done, { closeLoading }) => {
        const formData = createFormData({
          file: new File([avatarInfo.value.blob], "avatar.png", {
            type: avatarInfo.value.blob.type,
            lastModified: Date.now()
          })
        });
        handleOperation({
          t,
          apiReq: api.upload(row.pk, formData),
          success() {
            tableRef.value.handleGetData();
            done();
          },
          requestEnd() {
            closeLoading();
          }
        });
      },
      closeCallBack: () => cropRef.value.hidePopover()
    });
  }

  function onTreeSelect({ pk, selected }) {
    tableRef.value.handleGetData({ dept: selected ? pk : "", page: 1 });
  }

  /** 重置密码 */
  function handleReset(row) {
    addDialog({
      title: t("systemUser.resetPasswd", { user: row.username }),
      width: "30%",
      draggable: true,
      fullscreen: deviceDetection(),
      closeOnClickModal: false,
      contentRenderer: () => (
        <>
          <ElForm ref={ruleFormRef} model={pwdForm}>
            <ElFormItem
              prop="newPwd"
              rules={[
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
              ]}
            >
              <ElInput
                clearable
                show-password
                type="password"
                v-model={pwdForm.newPwd}
                placeholder={t("systemUser.password")}
              />
            </ElFormItem>
          </ElForm>
          <div class="my-4 flex">
            {pwdProgress.map(({ color, text }, idx) => (
              <div
                class="w-[19vw]"
                style={{ marginLeft: idx !== 0 ? "4px" : 0 }}
              >
                <ElProgress
                  striped
                  striped-flow
                  duration={curScore.value === idx ? 6 : 0}
                  percentage={curScore.value >= idx ? 100 : 0}
                  color={color}
                  stroke-width={10}
                  show-text={false}
                />
                <p
                  class="text-center"
                  style={{ color: curScore.value === idx ? color : "" }}
                >
                  {text}
                </p>
              </div>
            ))}
          </div>
        </>
      ),
      closeCallBack: () => (pwdForm.newPwd = ""),
      beforeSure: done => {
        ruleFormRef.value.validate(valid => {
          if (valid) {
            api
              .resetPassword(row.pk, {
                password: AesEncrypted(row.username, pwdForm.newPwd)
              })
              .then(res => {
                if (res.code === 1000) {
                  message(t("results.success"), { type: "success" });
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
                done(); // 关闭弹框
              });
          }
        });
      }
    });
  }

  onMounted(() => {
    if (auth.empower) {
      if (hasAuth("list:SystemRole")) {
        roleApi.list({ page: 1, size: 1000 }).then(res => {
          if (res.code === 1000 && res.data) {
            rolesOptions.value = res.data.results;
          }
        });
      }
      if (hasAuth("list:SystemDataPermission")) {
        dataPermissionApi
          .list({
            page: 1,
            size: 1000
          })
          .then(res => {
            if (res.code === 1000 && res.data) {
              rulesOptions.value = res.data.results;
            }
          });
      }
    }
    // 部门列表
    if (hasAuth("list:SystemDept")) {
      deptApi.list({ page: 1, size: 1000 }).then(res => {
        if (res.code === 1000 && res.data) {
          treeData.value = handleTree(res.data.results);
        }
      });
    }
    treeLoading.value = false;
  });

  watch(
    pwdForm,
    ({ newPwd }) =>
      (curScore.value = isAllEmpty(newPwd) ? -1 : zxcvbn(newPwd).score)
  );

  const selectionChange = data => {
    manySelectData.value = data;
    selectedNum.value = manySelectData.value.length ?? 0;
  };

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "avatar":
          column["cellRenderer"] = ({ row }) =>
            h(ElImage, {
              lazy: true,
              src: row[column._column?.key],
              alt: row[column._column?.key],
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
              {row.gender.label}
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
              valueOnClear: "",
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

  const roleRulesColumns = ref([]);
  const passwordRules = ref([]);
  const roleRules = ref({});
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

  function handleRoleRules(row: any) {
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
          apiReq: api.empower(row.pk, {
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

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("systemUser.batchSendNotice"),
        code: "batchSendNotice",
        props: {
          type: "primary",
          icon: useRenderIcon(Message),
          plain: true
        },
        onClick: () => {
          goNotice();
        },
        show: () => {
          return Boolean(hasAuth("create:SystemNotice") && selectedNum.value);
        }
      }
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 210,
    buttons: [
      {
        text: t("systemUser.logout"),
        code: "logout",
        props: (row, button) => {
          const disabled = row?.online_count === 0;
          return {
            ...(button?._?.props ?? {
              icon: useRenderIcon(Logout),
              link: true
            }),
            ...{ disabled, type: disabled ? "default" : "danger" }
          };
        },
        onClick: ({ row }) => {
          handleOperation({
            t,
            apiReq: api.logout(row.pk, {}),
            success() {
              tableRef.value.handleGetData();
            }
          });
        },
        show: auth.logout
      },
      {
        text: t("systemUser.editAvatar"),
        code: "upload",
        props: {
          type: "primary",
          icon: useRenderIcon(Avatar),
          plain: true,
          link: true
        },
        onClick: ({ row }) => {
          handleUpload(row);
        },
        show: auth.upload
      },
      {
        text: t("systemUser.resetPassword"),
        code: "resetPassword",
        props: {
          type: "primary",
          icon: useRenderIcon(Password),
          link: true
        },
        onClick: ({ row }) => {
          handleReset(row);
        },
        show: auth.resetPassword
      },
      {
        text: t("systemUser.assignRoles"),
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
      }
    ]
  });

  onMounted(() => {
    handleOperation({
      t,
      apiReq: rulesPasswordApi(),
      success({ data: { password_rules } }) {
        passwordRules.value = password_rules;
      },
      showSuccessMsg: false
    });
  });

  return {
    api,
    auth,
    treeData,
    treeLoading,
    addOrEditOptions,
    tableBarButtonsProps,
    operationButtonsProps,
    onTreeSelect,
    selectionChange,
    deviceDetection,
    listColumnsFormat,
    baseColumnsFormat
  };
}
