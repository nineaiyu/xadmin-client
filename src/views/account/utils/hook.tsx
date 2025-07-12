import { useI18n } from "vue-i18n";
import { createFormData, delay, deviceDetection } from "@pureadmin/utils";
import { hasAuth } from "@/router/utils";
import { computed, h, onMounted, reactive, type Ref, ref } from "vue";
import { userInfoApi } from "@/api/user/userinfo";
import { useUserStoreHook } from "@/store/modules/user";
import type { PlusColumn } from "plus-pro-components";
import {
  formatFormColumns,
  formatOptions,
  picturePng,
  usePublicHooks
} from "@/views/system/hooks";
import { addDialog } from "@/components/ReDialog/index";
import croppingUpload from "@/components/RePictureUpload";
import { userLoginLogApi } from "@/api/user/logs";
import type { PaginationProps } from "@pureadmin/table";
import {
  type PageTableColumn,
  handleOperation,
  openDialogDrawer,
  renderBooleanTag
} from "@/components/RePlusPage";
import BindEmailOrPhone from "../components/BindEmailOrPhone.vue";
import ChangePassword from "../components/ChangePassword.vue";
import { AesEncrypted } from "@/utils/aes";

export function useApiAuth() {
  const api = reactive({
    retrieve: userInfoApi.retrieve,
    bind: userInfoApi.bind,
    partialUpdate: userInfoApi.partialUpdate,
    resetPassword: userInfoApi.resetPassword,
    upload: userInfoApi.upload,
    choices: userInfoApi.choices
  });

  const auth = computed(() => ({
    upload: hasAuth("upload:UserInfo"),
    partialUpdate: hasAuth("partialUpdate:UserInfo"),
    bind: hasAuth("bind:UserInfo"),
    resetPassword: hasAuth("resetPassword:UserInfo")
  }));
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
          apiReq: api.partialUpdate(
            {},
            {
              username: row.username,
              nickname: row.nickname,
              gender: row.gender
            }
          ),
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
          apiReq: api.upload(formData),
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
  const { t } = useI18n();
  const api = reactive(userLoginLogApi);
  api.fields = undefined;

  const auth = reactive({
    list: hasAuth("list:UserLoginLog")
  });

  const { tagStyle } = usePublicHooks();

  const pagination = reactive<PaginationProps>({
    total: 0,
    pageSize: 15,
    currentPage: 1,
    background: true,
    layout: "prev, pager, next"
  });

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "status":
          column["cellRenderer"] = renderBooleanTag({
            t,
            tagStyle,
            field: column.prop,
            actionMap: { true: t("labels.success"), false: t("labels.failed") }
          });
          break;
      }
    });
    return columns;
  };

  return {
    t,
    api,
    auth,
    pagination,
    listColumnsFormat
  };
}

export function useAccountManage() {
  const { t } = useI18n();
  const { api, auth } = useApiAuth();
  const userinfoStore = useUserStoreHook();

  function handleBindEmailOrPhone(category: string) {
    openDialogDrawer({
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
    openDialogDrawer({
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
          apiReq: api.resetPassword(rowData),
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
