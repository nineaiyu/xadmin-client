import "./reset.css";
import dayjs from "dayjs";
import { message } from "@/utils/message";
import { zxcvbn } from "@zxcvbn-ts/core";
import { userApi } from "@/api/system/user";
import { ElForm, ElFormItem, ElInput, ElProgress } from "element-plus";
import {
  computed,
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
import roleForm from "../form/role.vue";
import Form from "../form/index.vue";
import type { FormItemProps, RoleFormItemProps } from "./types";
import { roleApi } from "@/api/system/role";
import {
  cloneDeep,
  deviceDetection,
  hideTextAtIndex,
  isAllEmpty
} from "@pureadmin/utils";
import { useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { handleTree } from "@/utils/tree";
import { deptApi } from "@/api/system/dept";
import { dataPermissionApi } from "@/api/system/permission";
import { ModeChoices } from "@/views/system/constants";
import { REGEXP_PWD } from "@/views/login/utils/rule";
import Info from "@iconify-icons/ri/question-line";
import { renderOption, renderSwitch } from "@/views/system/render";
import {
  formatFormColumns,
  formatHigherDeptOptions,
  formatOptions,
  picturePng
} from "@/views/system/hooks";
import type { PlusColumn } from "plus-pro-components";

export function useUser(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive({
    list: userApi.list,
    create: userApi.create,
    delete: userApi.delete,
    update: userApi.patch,
    fields: userApi.fields,
    reset: userApi.reset,
    empower: userApi.empower,
    choices: userApi.choices,
    upload: userApi.upload,
    batchDelete: userApi.batchDelete
  });

  const auth = reactive({
    list: hasAuth("list:systemUser"),
    create: hasAuth("create:systemUser"),
    delete: hasAuth("delete:systemUser"),
    update: hasAuth("update:systemUser"),
    fields: hasAuth("fields:systemUser"),
    reset: hasAuth("reset:systemUser"),
    empower: hasAuth("empower:systemUser"),
    upload: hasAuth("upload:systemUser"),
    choices: hasAuth("choices:systemUser"),
    batchDelete: hasAuth("batchDelete:systemUser")
  });

  const editForm = shallowRef({
    title: t("systemUser.user"),
    form: Form,
    row: {
      is_active: row => {
        return row?.is_active ?? true;
      },
      gender: row => {
        return row?.gender ?? 0;
      },
      roles: row => {
        return row?.roles ?? [];
      }
    },
    props: {
      treeData: () => {
        return formatHigherDeptOptions(cloneDeep(treeData.value));
      },
      genderChoices: () => {
        return choicesDict.value["gender"];
      }
    }
  });

  const cropRef = ref();
  const router = useRouter();
  const choicesDict = ref({});
  const treeData = ref([]);
  const treeLoading = ref(true);

  const rolesOptions = ref([]);
  const rulesOptions = ref([]);

  const selectedNum = ref(0);
  const manySelectData = ref([]);
  const avatarInfo = ref();
  const ruleFormRef = ref();

  const columns = ref<TableColumnList>([
    {
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      prop: "pk",
      width: 50
    },
    {
      prop: "avatar",
      minWidth: 90,
      cellRenderer: ({ row }) => (
        <el-image
          class={["w-[36px]", "h-[36px]", "align-middle"]}
          fit="cover"
          src={row.avatar}
          loading="lazy"
          preview-teleported
          preview-src-list={Array.of(row.avatar)}
        />
      )
    },
    {
      prop: "username",
      minWidth: 120,
      cellRenderer: ({ row }) => (
        <span v-show={row?.username} v-copy={row?.username}>
          {row?.username}
        </span>
      ),
      headerRenderer: () => (
        <span class="flex-c">
          {t("systemUser.username")}
          <iconifyIconOffline
            icon={Info}
            class={["ml-1", "cursor-help"]}
            v-tippy={{
              content: t("labels.dClickCopy")
            }}
          />
        </span>
      )
    },
    {
      prop: "nickname",
      minWidth: 130,
      cellRenderer: ({ row }) => (
        <span v-show={row?.nickname} v-copy={row?.nickname}>
          {row?.nickname}
        </span>
      )
    },
    {
      prop: "gender.label",
      minWidth: 90,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={row.gender === 2 ? "danger" : "primary"}
          effect="plain"
        >
          {row.gender.label}
        </el-tag>
      )
    },

    {
      prop: "is_active",
      minWidth: 90,
      cellRenderer: renderSwitch(auth.update, tableRef, "is_active", scope => {
        return scope.row.username;
      })
    },

    {
      prop: "dept_info",
      width: 140,
      cellRenderer: ({ row }) => (
        <span v-show={row?.dept_info?.name} v-copy={row?.dept_info?.name}>
          {row?.dept_info?.name}
        </span>
      )
    },
    {
      prop: "mobile",
      minWidth: 120,
      formatter: ({ mobile }) => hideTextAtIndex(mobile, { start: 3, end: 6 })
    },
    {
      minWidth: 160,
      prop: "last_login",
      formatter: ({ last_login }) =>
        dayjs(last_login).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      minWidth: 160,
      prop: "date_joined",
      formatter: ({ date_joined }) =>
        dayjs(date_joined).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      prop: "roles_info",
      width: 160,
      slot: "roles"
    },
    {
      prop: "rules_info",
      width: 160,
      slot: "rules"
    },
    {
      fixed: "right",
      width: 180,
      slot: "operation"
    }
  ]);

  const buttonClass = computed(() => {
    return [
      "!h-[20px]",
      "reset-margin",
      "!text-gray-500",
      "dark:!text-white",
      "dark:hover:!text-primary"
    ];
  });
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
    router.push({
      name: "SystemNotice",
      query: { notice_user: JSON.stringify(manySelectData.value) }
    });
  }

  /** 上传头像 */
  function handleUpload(row: FormItemProps) {
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
      beforeSure: done => {
        const avatarFile = new File([avatarInfo.value.blob], "avatar.png", {
          type: avatarInfo.value.blob.type,
          lastModified: Date.now()
        });
        const data = new FormData();
        data.append("file", avatarFile);
        api.upload(row.pk, data).then(res => {
          if (res.code === 1000) {
            message(t("results.success"), { type: "success" });
            tableRef.value.onSearch();
            done();
          } else {
            message(`${t("results.failed")}，${res.detail}`, { type: "error" });
            done();
          }
        });
      },
      closeCallBack: () => cropRef.value.hidePopover()
    });
  }

  function onTreeSelect({ pk, selected }) {
    tableRef.value.searchFields.dept = selected ? pk : "";
    tableRef.value.onSearch();
  }

  /** 分配角色 */
  function handleRole(row: FormItemProps) {
    addDialog({
      title: t("systemUser.assignRole", { user: row.username }),
      props: {
        formInline: {
          username: row?.username ?? "",
          nickname: row?.nickname ?? "",
          mode_type: row?.mode_type ?? ModeChoices.AND,
          roles: row?.roles ?? [],
          rules: row?.rules ?? []
        },
        rolesOptions: rolesOptions.value ?? [],
        rulesOptions: rulesOptions.value ?? [],
        modeChoices: choicesDict.value["mode_type"] ?? []
      },
      width: "600px",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(roleForm),
      beforeSure: (done, { options }) => {
        const curData = options.props.formInline as RoleFormItemProps;
        api
          .empower(row.pk, {
            roles: curData.roles,
            rules: curData.rules,
            mode_type: curData.mode_type
          })
          .then(res => {
            if (res.code === 1000) {
              message(t("results.success"), { type: "success" });
              tableRef.value.onSearch();
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

  /** 重置密码 */
  function handleReset(row: FormItemProps) {
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
                    if (value === "") {
                      callback(new Error(t("systemUser.password")));
                    } else if (!REGEXP_PWD.test(value)) {
                      callback(new Error(t("login.passwordRuleReg")));
                    } else {
                      callback();
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
          <div class="mt-4 flex">
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
            api.reset(row.pk, { password: pwdForm.newPwd }).then(res => {
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
    api.choices().then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
      }
    });
    if (auth.empower) {
      if (hasGlobalAuth("list:systemRole")) {
        roleApi.list({ page: 1, size: 1000 }).then(res => {
          if (res.code === 1000 && res.data) {
            rolesOptions.value = res.data.results;
          }
        });
      }
      if (hasGlobalAuth("list:systemDataPermission")) {
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
    if (hasGlobalAuth("list:systemDept")) {
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

  const selectionChange = func => {
    manySelectData.value = func();
    selectedNum.value = manySelectData.value.length ?? 0;
  };

  return {
    t,
    api,
    auth,
    columns,
    treeData,
    editForm,
    buttonClass,
    treeLoading,
    selectedNum,
    goNotice,
    handleRole,
    handleReset,
    onTreeSelect,
    handleUpload,
    selectionChange,
    deviceDetection
  };
}

export function useSystemUserForm(props) {
  const { t, te } = useI18n();
  const columns: PlusColumn[] = [
    {
      prop: "username",
      valueType: "input",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 }
    },
    {
      prop: "nickname",
      valueType: "input",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 }
    },

    {
      prop: "mobile",
      valueType: "input",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 }
    },
    {
      prop: "email",
      valueType: "input",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 }
    },
    {
      prop: "gender",
      valueType: "select",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 },
      options: formatOptions(props.genderChoices)
    },
    {
      prop: "password",
      valueType: "input",
      hideInForm: !props.isAdd,
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 }
    },
    {
      prop: "is_active",
      valueType: "radio",
      colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 },
      renderField: renderOption()
    },
    {
      prop: "dept",
      valueType: "cascader",
      fieldProps: {
        props: {
          value: "pk",
          label: "name",
          emitPath: false,
          checkStrictly: true
        }
      },
      options: props.treeData
    },
    {
      prop: "description",
      valueType: "textarea"
    }
  ];
  formatFormColumns(props, columns, t, te, "systemUser");
  return {
    t,
    columns
  };
}

export function useSystemUserRoleForm(props) {
  const { t, te } = useI18n();
  const customOptions = (data: Array<any>) => {
    const result = [];
    data?.forEach(item => {
      result.push({
        label: item?.name,
        value: item?.pk,
        fieldSlot: () => {
          return (
            <>
              <span style="float: left">{item.name}</span>
              <span
                style="
                  float: right;
                  font-size: 13px;
                  color: var(--el-text-color-secondary);
                "
              >
                {item.code ?? item.mode_type?.label}
              </span>
            </>
          );
        }
      });
    });
    return result;
  };
  const columns: PlusColumn[] = [
    {
      prop: "username",
      valueType: "input",
      fieldProps: { disabled: true }
    },
    {
      prop: "nickname",
      valueType: "input",
      fieldProps: { disabled: true }
    },
    {
      prop: "roles",
      valueType: "select",
      fieldProps: {
        multiple: true
      },
      options: customOptions(props.rolesOptions)
    },
    {
      prop: "mode_type",
      valueType: "select",
      options: formatOptions(props.modeChoices)
    },
    {
      prop: "rules",
      valueType: "select",
      fieldProps: {
        multiple: true
      },
      options: customOptions(props.rulesOptions)
    }
  ];
  formatFormColumns(props, columns, t, te, "systemUser");

  return {
    t,
    columns
  };
}
