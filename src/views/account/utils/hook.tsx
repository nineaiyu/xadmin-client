import { useI18n } from "vue-i18n";
import {
  cloneDeep,
  createFormData,
  delay,
  deviceDetection
} from "@pureadmin/utils";
import { hasGlobalAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { computed, h, onMounted, reactive, type Ref, ref, toRaw } from "vue";
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
import { userLoginLogApi } from "@/api/user/logs";
import dayjs from "dayjs";
import type { PaginationProps } from "@pureadmin/table";
import { handleOperation, openFormDialog } from "@/components/RePlusCRUD";
import BindEmailOrPhone from "../components/BindEmailOrPhone.vue";
import ChangePassword from "../components/ChangePassword.vue";
import { AesEncrypted } from "@/utils/aes";

export function useApiAuth() {
  const api = reactive({
    self: userInfoApi.self,
    bind: userInfoApi.bind,
    update: userInfoApi.patch,
    reset: userInfoApi.reset,
    upload: userInfoApi.upload,
    choices: userInfoApi.choices
  });

  const auth = reactive({
    upload: hasGlobalAuth("upload:UserInfo"),
    update: hasGlobalAuth("update:UserInfo"),
    bind: hasGlobalAuth("bind:UserInfo"),
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
    phone: "",
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
      prop: "operation",
      valueType: "input",
      hasLabel: false
    }
  ];
  formatFormColumns({}, columns, t, te, "userinfo");

  const handleUpdate = row => {
    formRef.value?.formInstance?.validate(valid => {
      if (valid) {
        handleOperation({
          t,
          apiReq: api.update("self", {
            username: row.username,
            nickname: row.nickname,
            gender: row.gender
          }),
          success() {
            getUserInfo();
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
            getUserInfo();
            done();
          },
          requestEnd() {
            closeLoading();
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
    list: userLoginLogApi.list
  });

  const auth = reactive({
    list: hasGlobalAuth("list:userLoginLog")
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
    t,
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
  const userinfoStore = useUserStoreHook();

  function handleBindEmailOrPhone(category: string) {
    openFormDialog({
      t,
      isAdd: false,
      title:
        category === "bind_email"
          ? t("userinfo.bindEmail")
          : t("userinfo.bindPhone"),
      rawRow: {
        form_type: category === "bind_email" ? "email" : "phone",
        verify_code: "",
        verify_token: undefined
      },
      rawColumns: [
        {
          label: t("userinfo.avatar"),
          prop: "avatar",
          valueType: "avatar"
        },
        {
          label: t("userinfo.username"),
          prop: "username",
          valueType: "input"
        },
        {
          label: t("userinfo.nickname"),
          prop: "nickname",
          valueType: "input"
        }
      ],
      props: { category },
      form: BindEmailOrPhone,
      saveCallback: ({ formData, done, closeLoading }) => {
        const rawData = {
          verify_token: formData.verify_token,
          verify_code: formData.verify_code
        };
        handleOperation({
          t,
          apiReq: api.bind(rawData),
          success() {
            userinfoStore.getUserInfo();
            done();
          },
          requestEnd() {
            closeLoading();
          }
        });
      }
    });
  }

  function handleChangePassword() {
    openFormDialog({
      t,
      isAdd: false,
      title: t("userinfo.changePassword"),
      rawRow: {
        old_password: "",
        new_password: "",
        sure_password: ""
      },
      form: ChangePassword,
      saveCallback: ({ formData, done, closeLoading }) => {
        const rowData = {
          old_password: AesEncrypted(
            userinfoStore.username,
            formData.old_password
          ),
          sure_password: AesEncrypted(
            userinfoStore.username,
            formData.sure_password
          )
        };
        handleOperation({
          t,
          apiReq: api.reset(rowData),
          success() {
            done();
          },
          requestEnd() {
            closeLoading();
          }
        });
      }
    });
  }

  return {
    t,
    api,
    auth,
    userinfoStore,
    handleChangePassword,
    handleBindEmailOrPhone
  };
}
