import { ref } from "vue";
import type { AuthInfoResult } from "@/api/auth";
import type { RecordType } from "plus-pro-components";

/**
 * 验证码场景页内配置(verify?category= 回传)的合并态。
 *
 * 与登录页能力清单(auth/capabilities,外壳拉取、入口可见性判断)的分工:
 * 本状态只承载 ReSendVerifyCode 回传的**页内细节**——发码冷却、加密开关、
 * 密码规则等;「该渲染哪些登录方式入口」不在这里判断。
 * 账密登录页(Basic)已完全改读能力清单,不再消费本状态。
 */
export function useAuthInfo() {
  const authInfo = ref<Partial<AuthInfoResult["data"]>>({});
  const configLoading = ref(false);
  /** 配置接口返回后合并进 authInfo（增量合并，缺省字段保持 undefined） */
  const onConfig = (config: RecordType) => {
    Object.assign(authInfo.value, config);
  };
  return { authInfo, configLoading, onConfig };
}
