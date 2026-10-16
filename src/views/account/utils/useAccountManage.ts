import { useI18n } from "vue-i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { handleOperation, openDialogDrawer } from "@/components/RePlusPage";
import { AesEncrypted } from "@/utils/aes";
import BindEmailOrPhone from "../components/BindEmailOrPhone.vue";
import ChangePassword from "../components/ChangePassword.vue";
import { useApiAuth } from "./useApiAuth";

/** 账户管理（绑定邮箱/手机、修改密码）；自 utils/hook 拆出，行为不变 */
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
      saveCallback: async ({ formData, done, closeLoading }) => {
        // 载荷口径：sure_password 即新密码（后端 resetPassword 契约只收
        // old_password + sure_password，服务端 set_password 取后者）；
        // formData.new_password 是表单本地校验字段，绝不出现在载荷里
        const rowData = {
          old_password: await AesEncrypted(
            userinfoStore.username as string,
            formData.old_password
          ),
          sure_password: await AesEncrypted(
            userinfoStore.username as string,
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
