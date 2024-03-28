import "./reset.css";
import dayjs from "dayjs";
import { message } from "@/utils/message";
import { zxcvbn } from "@zxcvbn-ts/core";
import {
  createUserApi,
  deleteUserApi,
  empowerRoleApi,
  getUserListApi,
  manyDeleteUserApi,
  updateUserApi,
  updateUserPasswordApi,
  uploadUserAvatarApi
} from "@/api/system/user";
import {
  ElForm,
  ElFormItem,
  ElInput,
  ElMessageBox,
  ElProgress
} from "element-plus";
import type { PaginationProps } from "@pureadmin/table";
import {
  computed,
  h,
  onMounted,
  reactive,
  ref,
  type Ref,
  toRaw,
  watch
} from "vue";
import { addDialog } from "@/components/ReDialog";
import croppingUpload from "@/components/RePictureUpload/index.vue";
import roleForm from "../form/role.vue";
import editForm from "../form/index.vue";
import type { FormItemProps, RoleFormItemProps } from "./types";
import { getRoleListApi } from "@/api/system/role";
import {
  cloneDeep,
  delay,
  deviceDetection,
  getKeyList,
  hideTextAtIndex,
  isAllEmpty,
  isEmpty,
  isString
} from "@pureadmin/utils";
import { useRoute, useRouter } from "vue-router";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { handleTree } from "@/utils/tree";
import { getDeptListApi } from "@/api/system/dept";
import {
  formatColumns,
  formatHigherDeptOptions,
  formatOptions,
  picturePng
} from "@/views/system/hooks";
import { getDataPermissionListApi } from "@/api/system/permission";
import { ModeChoices } from "@/views/system/constants";
import { REGEXP_PWD } from "@/views/login/utils/rule";
import Info from "@iconify-icons/ri/question-line";
import type { PlusColumn } from "plus-pro-components";

export function useUser(tableRef: Ref) {
  const { t } = useI18n();
  const sortOptions = [
    {
      label: `${t("sorts.registrationDate")} ${t("labels.descending")}`,
      key: "-date_joined"
    },
    {
      label: `${t("sorts.registrationDate")} ${t("labels.ascending")}`,
      key: "date_joined"
    },
    {
      label: `${t("sorts.loginDate")} ${t("labels.descending")}`,
      key: "-last_login"
    },
    {
      label: `${t("sorts.loginDate")} ${t("labels.ascending")}`,
      key: "last_login"
    }
  ];
  const form = ref({
    pk: "",
    dept: "",
    mobile: "",
    username: "",
    mode_type: "",
    is_active: "",
    description: "",
    ordering: sortOptions[0].key,
    page: 1,
    size: 10
  });

  const formRef = ref();
  const cropRef = ref();
  const router = useRouter();
  const route = useRoute();
  const getParameter = isEmpty(route.params) ? route.query : route.params;
  const dataList = ref([]);
  const loading = ref(true);
  const choicesDict = ref([]);
  const modeChoicesDict = ref([]);
  const treeData = ref([]);
  const treeLoading = ref(true);
  const rolesOptions = ref([]);
  const rulesOptions = ref([]);
  const switchLoadMap = ref({});
  const selectedNum = ref(0);
  const avatarInfo = ref();
  const ruleFormRef = ref();
  const showColumns = ref([]);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 10,
    currentPage: 1,
    pageSizes: [5, 10, 20, 50, 100],
    background: true
  });
  const columns = ref<TableColumnList>([
    {
      label: t("labels.checkColumn"),
      type: "selection",
      fixed: "left",
      reserveSelection: true
    },
    {
      label: t("labels.id"),
      prop: "pk",
      minWidth: 130
    },
    {
      label: t("user.avatar"),
      prop: "avatar",
      minWidth: 160,
      cellRenderer: ({ row }) => (
        <el-image
          class="w-[36px] h-[36px] align-middle"
          fit="cover"
          src={row.avatar}
          loading={"lazy"}
          preview-teleported={true}
          preview-src-list={Array.of(row.avatar)}
        />
      )
    },
    {
      label: t("user.username"),
      prop: "username",
      minWidth: 130,
      cellRenderer: ({ row }) => (
        <span v-show={row?.username} v-copy={row?.username}>
          {row?.username}
        </span>
      ),
      headerRenderer: () => (
        <span class="flex-c">
          {t("user.username")}
          <iconifyIconOffline
            icon={Info}
            class="ml-1 cursor-help"
            v-tippy={{
              content: t("labels.dClickCopy")
            }}
          />
        </span>
      )
    },
    {
      label: t("user.nickname"),
      prop: "nickname",
      minWidth: 130,
      cellRenderer: ({ row }) => (
        <span v-show={row?.nickname} v-copy={row?.nickname}>
          {row?.nickname}
        </span>
      )
    },
    {
      label: t("user.gender"),
      prop: "gender",
      minWidth: 90,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={row.gender === 2 ? "danger" : "primary"}
          effect="plain"
        >
          {row.gender_display}
        </el-tag>
      )
    },

    {
      label: t("labels.status"),
      prop: "is_active",
      minWidth: 90,
      cellRenderer: scope => (
        <el-switch
          size={scope.props.size === "small" ? "small" : "default"}
          loading={switchLoadMap.value[scope.index]?.loading}
          v-model={scope.row.is_active}
          active-value={true}
          inactive-value={false}
          active-text={t("labels.active")}
          inactive-text={t("labels.inactive")}
          disabled={!hasAuth("update:systemUser")}
          inline-prompt
          onChange={() => onChange(scope as any)}
        />
      )
    },

    {
      label: t("user.dept"),
      prop: "dept_info",
      width: 100,
      cellRenderer: ({ row }) => (
        <span v-show={row?.dept_info?.name} v-copy={row?.dept_info?.name}>
          {row?.dept_info?.name}
        </span>
      )
    },
    {
      label: t("user.mobile"),
      prop: "mobile",
      minWidth: 90,
      formatter: ({ mobile }) => hideTextAtIndex(mobile, { start: 3, end: 6 })
    },
    {
      label: t("user.registrationDate"),
      minWidth: 90,
      prop: "date_joined",
      formatter: ({ date_joined }) =>
        dayjs(date_joined).format("YYYY-MM-DD HH:mm:ss")
    },
    {
      label: t("user.roles"),
      prop: "roles_info",
      width: 160,
      slot: "roles"
    },
    {
      label: t("user.rules"),
      prop: "rules_info",
      width: 160,
      slot: "rules"
    },
    {
      label: t("labels.operations"),
      fixed: "right",
      width: 180,
      slot: "operation"
    }
  ]);

  const searchColumns: PlusColumn[] = computed(() => {
    return [
      {
        label: t("labels.id"),
        prop: "pk",
        valueType: "input"
      },
      {
        label: t("user.username"),
        prop: "username",
        valueType: "input"
      },
      {
        label: t("user.mobile"),
        prop: "mobile",
        valueType: "input"
      },
      {
        label: t("labels.status"),
        prop: "is_active",
        valueType: "select",
        options: [
          {
            label: t("labels.enable"),
            value: true
          },
          {
            label: t("labels.disable"),
            value: false
          }
        ]
      },
      {
        label: t("permission.mode"),
        prop: "mode_type",
        valueType: "select",
        options: formatOptions(modeChoicesDict.value)
      },
      {
        label: t("labels.description"),
        prop: "description",
        valueType: "input"
      },
      {
        label: t("labels.sort"),
        prop: "ordering",
        valueType: "select",
        options: formatOptions(sortOptions)
      }
    ];
  });

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

  function onChange({ row, index }) {
    const action =
      row.is_active === false ? t("labels.disable") : t("labels.enable");
    ElMessageBox.confirm(
      `${t("buttons.operateConfirm", {
        action: `<strong>${action}</strong>`,
        message: `<strong style="color:var(--el-color-primary)">${row.username}</strong>`
      })}`,
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
        type: "warning",
        dangerouslyUseHTMLString: true,
        draggable: true
      }
    )
      .then(() => {
        switchLoadMap.value[index] = Object.assign(
          {},
          switchLoadMap.value[index],
          {
            loading: true
          }
        );
        updateUserApi(row.pk, row).then(res => {
          if (res.code === 1000) {
            switchLoadMap.value[index] = Object.assign(
              {},
              switchLoadMap.value[index],
              {
                loading: false
              }
            );
            message(t("results.success"), { type: "success" });
          } else {
            message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          }
        });
      })
      .catch(() => {
        row.is_active === false
          ? (row.is_active = true)
          : (row.is_active = false);
      });
  }

  function handleDelete(row) {
    deleteUserApi(row.pk).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  }

  function handleSizeChange(val: number) {
    form.value.page = 1;
    form.value.size = val;
    onSearch();
  }

  function handleCurrentChange(val: number) {
    form.value.page = val;
    onSearch();
  }

  function handleSelectionChange(val) {
    selectedNum.value = val.length;
  }

  function onSelectionCancel() {
    selectedNum.value = 0;
    // 用于多选表格，清空用户的选择
    tableRef.value.getTableRef().clearSelection();
  }

  function handleManyDelete() {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    manyDeleteUserApi({
      pks: JSON.stringify(getKeyList(manySelectData, "pk"))
    }).then(res => {
      if (res.code === 1000) {
        message(t("results.batchDelete", { count: selectedNum.value }), {
          type: "success"
        });
        onSelectionCancel();
        onSearch();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
      tableRef.value.getTableRef().clearSelection();
    });
  }

  function onSearch(init = false) {
    if (init) {
      pagination.currentPage = form.value.page = 1;
      pagination.pageSize = form.value.size = 10;
    }
    loading.value = true;
    getUserListApi(toRaw(form.value)).then(res => {
      if (res.code === 1000 && res.data) {
        formatColumns(res.data?.results, columns, showColumns);
        dataList.value = res.data.results;
        pagination.total = res.data.total;
        choicesDict.value = res.choices_dict;
        modeChoicesDict.value = res.mode_choices;
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
      delay(500).then(() => {
        loading.value = false;
      });
    });
  }

  function goNotice() {
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    router.push({
      name: "SystemNotice",
      query: { notice_user: JSON.stringify(getKeyList(manySelectData, "pk")) }
    });
  }

  function openDialog(isAdd = true, row?: FormItemProps) {
    let title = t("buttons.edit");
    if (isAdd) {
      title = t("buttons.add");
    }
    addDialog({
      title: `${title} ${t("user.user")}`,
      props: {
        formInline: {
          pk: row?.pk ?? "",
          username: row?.username ?? "",
          nickname: row?.nickname ?? "",
          avatar: row?.avatar ?? "",
          dept: row?.dept ?? "",
          mobile: row?.mobile ?? "",
          email: row?.email ?? "",
          gender: row?.gender ?? 0,
          roles: row?.roles ?? [],
          password: row?.password ?? "",
          is_active: row?.is_active ?? true,
          description: row?.description ?? ""
        },
        treeData: formatHigherDeptOptions(cloneDeep(treeData.value)),
        choicesDict: choicesDict.value,
        showColumns: showColumns.value,
        isAdd: isAdd
      },
      width: "46%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef }),
      beforeSure: (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;

        function chores(detail) {
          message(detail, { type: "success" });
          done(); // 关闭弹框
          onSearch(); // 刷新表格数据
        }

        FormRef.validate(valid => {
          if (valid) {
            // 表单规则校验通过
            if (isAdd) {
              createUserApi(curData).then(res => {
                if (res.code === 1000) {
                  chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            } else {
              updateUserApi(curData.pk, curData).then(res => {
                if (res.code === 1000) {
                  chores(res.detail);
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
              });
            }
          }
        });
      }
    });
  }

  const exportExcel = () => {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    loading.value = true;
    const manySelectData = tableRef.value.getTableRef().getSelectionRows();
    console.log(manySelectData);
  };

  /** 上传头像 */
  function handleUpload(row) {
    addDialog({
      title: t("user.updateAvatar", { user: row.username }),
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
        uploadUserAvatarApi(row.pk, data).then(res => {
          if (res.code === 1000) {
            message(t("results.success"), { type: "success" });
            onSearch();
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
    form.value.dept = selected ? pk : "";
    onSearch();
  }

  /** 分配角色 */
  function handleRole(row) {
    addDialog({
      title: t("user.assignRole", { user: row.username }),
      props: {
        formInline: {
          username: row?.username ?? "",
          nickname: row?.nickname ?? "",
          mode_type: row?.mode_type ?? ModeChoices.AND,
          rolesOptions: rolesOptions.value ?? [],
          rulesOptions: rulesOptions.value ?? [],
          choicesDict: modeChoicesDict.value ?? [],
          ids: row?.roles ?? [],
          pks: row?.rules ?? []
        }
      },
      width: "600px",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(roleForm),
      beforeSure: (done, { options }) => {
        const curData = options.props.formInline as RoleFormItemProps;
        empowerRoleApi(row.pk, {
          roles: curData.ids,
          rules: curData.pks,
          mode_type: curData.mode_type
        }).then(res => {
          if (res.code === 1000) {
            message(t("results.success"), { type: "success" });
            onSearch();
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
  function handleReset(row) {
    addDialog({
      title: t("user.resetPasswd", { user: row.username }),
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
                      callback(new Error(t("user.verifyPassword")));
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
                placeholder={t("user.verifyPassword")}
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
            updateUserPasswordApi(row.pk, { password: pwdForm.newPwd }).then(
              res => {
                if (res.code === 1000) {
                  message(t("results.success"), { type: "success" });
                } else {
                  message(`${t("results.failed")}，${res.detail}`, {
                    type: "error"
                  });
                }
                done(); // 关闭弹框
              }
            );
          }
        });
      }
    });
  }

  onMounted(() => {
    if (getParameter) {
      const parameter = cloneDeep(getParameter);
      Object.keys(parameter).forEach(param => {
        if (!isString(parameter[param])) {
          parameter[param] = parameter[param].toString();
        }
      });
      form.value.pk = parameter.pk;
      form.value.dept = parameter.dept;
    }
    onSearch();
    // 角色列表
    if (hasGlobalAuth("list:systemRole")) {
      getRoleListApi({ page: 1, size: 1000 }).then(res => {
        if (res.code === 1000 && res.data) {
          rolesOptions.value = res.data.results;
        }
      });
    }
    if (hasGlobalAuth("list:systemDataPermission")) {
      getDataPermissionListApi({
        page: 1,
        size: 1000
      }).then(res => {
        if (res.code === 1000 && res.data) {
          rulesOptions.value = res.data.results;
        }
      });
    }
    // 部门列表
    if (hasGlobalAuth("list:systemDept")) {
      getDeptListApi({ page: 1, size: 1000 }).then(res => {
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

  return {
    t,
    form,
    loading,
    columns,
    dataList,
    treeData,
    pagination,
    buttonClass,
    treeLoading,
    selectedNum,
    searchColumns,
    onSearch,
    goNotice,
    handleRole,
    openDialog,
    exportExcel,
    handleDelete,
    onTreeSelect,
    handleUpload,
    handleReset,
    deviceDetection,
    handleManyDelete,
    handleSizeChange,
    onSelectionCancel,
    handleCurrentChange,
    handleSelectionChange
  };
}
