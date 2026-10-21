import { ref } from "vue";
import type { AuthInfoResult } from "@/api/auth";
import type { RecordType } from "plus-pro-components";

/**
 * 登录域配置（authInfo）的共享状态：账号密码 / 验证码登录 / 注册 / 重置密码
 * 四个子页消费同一个后端配置接口（/api/identity/login/basic 或
 * /api/identity/auth/verify），此前四页各写一份本地形状（7 字段 / 4 字段 /
 * 3 字段）导致字段缺失时依赖运行时兜底。本组合式函数统一为
 * ``Partial<AuthInfoResult["data"]>``：类型即后端响应，缺字段即 undefined。
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
