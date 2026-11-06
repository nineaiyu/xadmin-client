import { useI18n } from "vue-i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { handleOperation, openDialogDrawer } from "@/components/RePlusPage";
import { isSuccess } from "@/api/types";
import { AesEncrypted, AesEncryptedChallenge } from "@/utils/aes";
import BindEmailOrPhone from "../components/BindEmailOrPhone.vue";
import ChangePassword from "../components/ChangePassword.vue";
import { useApiAuth } from "./useApiAuth";
import { useBindAvailability } from "./useBindAvailability";
import { confirmBindConflict } from "./confirmBindConflict";

/** 账户管理（绑定邮箱/手机、修改密码）；自 utils/hook 拆出，行为不变 */
export function useAccountManage() {
  const { t } = useI18n();
  const { api, auth } = useApiAuth();
  const userinfoStore = useUserStoreHook();
  const { bindAvailability } = useBindAvailability();

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
        if (!confirmBindConflict(formData, t, closeLoading)) return;
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

  /**
   * 构造改密载荷密文：优先 v4 协议（服务端下发的随机挑战为密钥，不可预测）；
   * 挑战端点不存在 / 拉取失败时回退 username 协议（后端未升级或已回滚的
   * 部署窗口，存量协议继续兼容解密）。
   */
  async function buildChangePasswordPayload(formData: {
    old_password?: unknown;
    sure_password?: unknown;
  }) {
    const oldPassword = String(formData.old_password ?? "");
    const surePassword = String(formData.sure_password ?? "");
    try {
      const res = await api.passwordChallenge();
      const challenge = isSuccess(res) ? res.data?.challenge : "";
      if (challenge) {
        return {
          old_password: await AesEncryptedChallenge(challenge, oldPassword),
          sure_password: await AesEncryptedChallenge(challenge, surePassword)
        };
      }
    } catch {
      // 挑战端点 404（后端未升级 / 已回滚）→ 走下方 username 回退
    }
    const username = userinfoStore.username as string;
    return {
      old_password: await AesEncrypted(username, oldPassword),
      sure_password: await AesEncrypted(username, surePassword)
    };
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
        const rowData = await buildChangePasswordPayload(formData);
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
    bindAvailability,
    handleChangePassword,
    handleBindEmailOrPhone
  };
}
