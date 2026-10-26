import { onMounted, reactive } from "vue";
import { isSuccess } from "@/api/types";
import { verifyCodeConfigApi } from "@/api/auth";

/**
 * 绑定通道可用性（系统开关 + 投递通道就绪）：账户管理的手机/邮箱「更新」
 * 按钮据此置灰；验证码配置失败时保持不可用（fail-closed，不给出无凭据入口）。
 */
export function useBindAvailability() {
  const bindAvailability = reactive({ email: false, sms: false });

  const load = async () => {
    const [emailRes, phoneRes] = await Promise.all([
      verifyCodeConfigApi({ category: "bind_email" }).catch(() => null),
      verifyCodeConfigApi({ category: "bind_phone" }).catch(() => null)
    ]);
    if (emailRes && isSuccess(emailRes)) {
      bindAvailability.email = Boolean(
        emailRes.data.access && emailRes.data.email
      );
    }
    if (phoneRes && isSuccess(phoneRes)) {
      bindAvailability.sms = Boolean(phoneRes.data.access && phoneRes.data.sms);
    }
  };

  onMounted(load);
  return { bindAvailability };
}
