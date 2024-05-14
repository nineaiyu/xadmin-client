import { useI18n } from "vue-i18n";
import {
  cloneDeep,
  createFormData,
  delay,
  deviceDetection,
  isAllEmpty
} from "@pureadmin/utils";
import { hasGlobalAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  computed,
  h,
  onMounted,
  reactive,
  type Ref,
  ref,
  toRaw,
  watch
} from "vue";
import { userInfoApi } from "@/api/user/userinfo";
import { useUserStoreHook } from "@/store/modules/user";
import type { PlusColumn } from "plus-pro-components";
import {
  formatColumnsLabel,
  formatFormColumns,
  formatOptions,
  picturePng,
  usePublicHooks
} from "@/views/system/hooks";
import { addDialog } from "@/components/ReDialog/index";
import croppingUpload from "@/components/RePictureUpload";
import { loginLogApi } from "@/api/system/logs/login";
import dayjs from "dayjs";
import type { PaginationProps } from "@pureadmin/table";
import {
  ElForm,
  ElFormItem,
  ElInput,
  ElProgress,
  type FormRules
} from "element-plus";
import { REGEXP_PWD } from "@/views/login/utils/rule";
import { $t, transformI18n } from "@/plugins/i18n";
import { zxcvbn } from "@zxcvbn-ts/core";

export function useApiAuth() {
  const api = reactive({
    self: userInfoApi.self,
    update: userInfoApi.update,
    reset: userInfoApi.reset,
    upload: userInfoApi.upload,
    choices: userInfoApi.choices
  });

  const auth = reactive({
    upload: hasGlobalAuth("upload:UserInfo"),
    update: hasGlobalAuth("update:UserInfo"),
    reset: hasGlobalAuth("reset:UserInfo")
  });
  return {
    api,
    auth
  };
}

export function useUserProfileForm(formRef: Ref) {
  const { t, te } = useI18n();
  const { api, auth } = useApiAuth();
  const userinfoStore = useUserStoreHook();
  const choicesDict = ref({});
  const avatarInfo = ref();
  const cropRef = ref();
  const userInfo = ref({
    username: "",
    nickname: "",
    avatar: "",
    mobile: "",
    email: "",
    gender: 0
  });

  const columns: PlusColumn[] = [
    {
      prop: "avatar",
      valueType: "input"
    },
    {
      prop: "username",
      valueType: "input"
    },
    {
      prop: "nickname",
      valueType: "input"
    },
    {
      prop: "gender",
      valueType: "select",
      // colProps: { xs: 24, sm: 24, md: 24, lg: 12, xl: 12 },
      options: computed(() => {
        return formatOptions(choicesDict.value["gender"]);
      })
    },
    {
      prop: "mobile",
      valueType: "input"
    },
    {
      prop: "email",
      valueType: "autocomplete",
      fieldProps: {
        fetchSuggestions(queryString, callback) {
          const emailList = [
            { value: "@qq.com" },
            { value: "@126.com" },
            { value: "@163.com" }
          ];
          let results = [];
          let queryList = [];
          emailList.map(item =>
            queryList.push({ value: queryString.split("@")[0] + item.value })
          );
          results = queryString
            ? queryList.filter(
                item =>
                  item.value
                    .toLowerCase()
                    .indexOf(queryString.toLowerCase()) === 0
              )
            : queryList;
          callback(results);
        },
        triggerOnFocus: false
      }
    },

    {
      prop: "operation",
      valueType: "input",
      hasLabel: false
    }
  ];
  formatFormColumns({}, columns, t, te, "userinfo");

  const handleUpdate = row => {
    formRef.value?.formInstance?.validate(valid => {
      if (valid) {
        api.update("self", row).then(res => {
          if (res.code === 1000) {
            message(t("results.success"), { type: "success" });
          } else {
            message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          }
        });
      }
    });
  };

  const handleUpload = row => {
    addDialog({
      title: t("userinfo.updateAvatar", { user: row.username }),
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      // destroyOnClose: true,
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
        const formData = createFormData({
          file: new File([avatarInfo.value.blob], "avatar.png", {
            type: avatarInfo.value.blob.type,
            lastModified: Date.now()
          })
        });
        api.upload(row.pk, formData).then(res => {
          if (res.code === 1000) {
            message(t("results.success"), { type: "success" });
            getUserInfo();
            done();
          } else {
            message(`${t("results.failed")}，${res.detail}`, { type: "error" });
            done();
          }
        });
      },
      beforeClose: done => {
        cropRef.value.hidePopover();
        delay(200).then(() => {
          done();
        });
      }
    });
  };

  const getUserInfo = () => {
    userinfoStore.getUserInfo().then(res => {
      Object.assign(userInfo.value, res.data);
    });
  };
  onMounted(() => {
    getUserInfo();
    api.choices().then(res => {
      choicesDict.value = res.choices_dict;
    });
  });

  return {
    t,
    api,
    auth,
    columns,
    userInfo,
    choicesDict,
    userinfoStore,
    getUserInfo,
    handleUpload,
    handleUpdate
  };
}

export function useUserLoginLog() {
  const { t, te } = useI18n();
  const api = reactive({
    list: loginLogApi.list
  });

  const auth = reactive({
    list: hasGlobalAuth("list:systemLoginLog")
  });

  const { tagStyle } = usePublicHooks();

  const loading = ref(true);
  const dataList = ref([]);
  const showColumns = ref([]);
  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 15,
    currentPage: 1,
    background: true,
    layout: "prev, pager, next"
  });

  const columns = ref<TableColumnList>([
    {
      prop: "pk",
      minWidth: 100
    },
    {
      prop: "ipaddress",
      minWidth: 150
    },
    {
      prop: "login_type.label",
      minWidth: 150
    },
    {
      prop: "browser",
      minWidth: 150
    },
    {
      prop: "system",
      minWidth: 150
    },
    {
      prop: "agent",
      minWidth: 150
    },
    {
      prop: "status",
      minWidth: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag size={props.size} style={tagStyle.value(row.status)}>
          {row.status ? t("labels.success") : t("labels.failed")}
        </el-tag>
      )
    },
    {
      minWidth: 180,
      prop: "created_time",
      formatter: ({ created_time }) =>
        dayjs(created_time).format("YYYY-MM-DD HH:mm:ss")
    }
  ]);
  const formatColumns = (results, columns) => {
    if (results.length > 0) {
      showColumns.value = Object.keys(results[0]);
      cloneDeep(columns).forEach(column => {
        if (
          column?.prop &&
          showColumns.value.indexOf(column?.prop.split(".")[0]) === -1
        ) {
          columns.splice(
            columns.findIndex(obj => {
              return obj.label === column.label;
            }),
            1
          );
        }
      });
    }
  };
  formatColumnsLabel(columns.value, t, te, "logsLogin");
  const form = reactive({
    ordering: "-created_time",
    page: pagination.currentPage,
    size: pagination.pageSize
  });
  const onSearch = () => {
    loading.value = true;
    form.page = pagination.currentPage;
    api
      .list(toRaw(form))
      .then(res => {
        if (res.code === 1000 && res.data) {
          formatColumns(res.data?.results, columns.value);
          dataList.value = res.data.results;
          pagination.total = res.data.total;
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        delay(500).then(() => {
          loading.value = false;
        });
      })
      .catch(() => {
        loading.value = false;
      });
  };

  onMounted(() => {
    onSearch();
  });

  return {
    api,
    auth,
    columns,
    loading,
    dataList,
    pagination,
    onSearch
  };
}

export function useAccountManage() {
  const { t } = useI18n();
  const { api, auth } = useApiAuth();

  const ruleFormRef = ref();
  const pwdForm = reactive({
    old_password: "",
    new_password: "",
    sure_password: ""
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
  const formPasswordRules = reactive<FormRules>({
    old_password: [
      {
        required: true,
        message: t("userinfo.verifyOldPassword"),
        trigger: "blur"
      }
    ],
    new_password: [
      {
        required: true,
        validator: (rule, value, callback) => {
          if (value === "") {
            callback(
              new Error(transformI18n($t("userinfo.verifyNewPassword")))
            );
          } else if (!REGEXP_PWD.test(value)) {
            callback(new Error(transformI18n($t("login.passwordRuleReg"))));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ],
    sure_password: [
      {
        validator: (rule, value, callback) => {
          if (value !== pwdForm.new_password) {
            callback(new Error(t("login.passwordDifferentReg")));
          } else {
            callback();
          }
        },
        trigger: "blur"
      }
    ]
  });

  /** 重置密码 */
  function handleReset() {
    addDialog({
      title: t("userinfo.changePassword"),
      width: "40%",
      draggable: true,
      fullscreen: deviceDetection(),
      closeOnClickModal: false,
      contentRenderer: () => (
        <>
          <ElForm ref={ruleFormRef} model={pwdForm} rules={formPasswordRules}>
            <ElFormItem prop="old_password" label={t("userinfo.oldPassword")}>
              <ElInput
                clearable
                show-password
                type="password"
                v-model={pwdForm.old_password}
                placeholder={t("userinfo.verifyOldPassword")}
              />
            </ElFormItem>
            <ElFormItem prop="new_password" label={t("userinfo.newPassword")}>
              <ElInput
                clearable
                show-password
                type="password"
                v-model={pwdForm.new_password}
                placeholder={t("userinfo.verifyNewPassword")}
              />
            </ElFormItem>
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
            <ElFormItem prop="sure_password" label={t("userinfo.surePassword")}>
              <ElInput
                clearable
                show-password
                type="password"
                v-model={pwdForm.sure_password}
                placeholder={t("userinfo.verifyNewPassword")}
              />
            </ElFormItem>
          </ElForm>
        </>
      ),
      closeCallBack: () => (pwdForm.new_password = ""),
      beforeSure: done => {
        ruleFormRef.value.validate(valid => {
          if (valid) {
            api.reset(pwdForm).then(res => {
              if (res.code === 1000) {
                message(t("results.success"), { type: "success" });
                done(); // 关闭弹框
              } else {
                message(`${t("results.failed")}，${res.detail}`, {
                  type: "error"
                });
              }
            });
          }
        });
      }
    });
  }

  watch(
    pwdForm,
    ({ new_password }) =>
      (curScore.value = isAllEmpty(new_password)
        ? -1
        : zxcvbn(new_password).score)
  );

  return {
    api,
    auth,
    handleReset
  };
}
