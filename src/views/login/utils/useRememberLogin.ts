import { ref, watch } from "vue";
import { useLoginPageStoreHook } from "@/store/modules/loginPage";
import { formatLoginDayList } from "./loginShared";

/**
 * 「记住我」勾选与免登录天数的共享状态（自 useLoginFlow 抽出）：账号密码登录与
 * 验证码登录两个子页的勾选/天数/选项列表行为完全一致，收敛于此。勾选与天数
 * 变化即同步 loginPage store（登录接口按此决定免登录 cookie），随组件卸载
 * 自动释放监听。
 */
export function useRememberLogin() {
  const checked = ref(true);
  const loginDay = ref(1);
  const loginDayList = ref<number[]>([1]);

  /** 按当前免登录天数刷新下拉选项（幂等，可安全随配置返回重复调用） */
  const formatLoginDayOptions = () => {
    loginDayList.value = formatLoginDayList(loginDay.value);
  };

  /** 把当前勾选与天数显式同步进 store（配置就绪时即使值未变化也要落库） */
  const syncRememberToStore = () => {
    useLoginPageStoreHook().SET_ISREMEMBERED(checked.value);
    useLoginPageStoreHook().SET_LOGINDAY(loginDay.value);
  };

  watch(checked, bool => {
    useLoginPageStoreHook().SET_ISREMEMBERED(bool);
  });
  watch(loginDay, value => {
    useLoginPageStoreHook().SET_LOGINDAY(value);
  });

  return {
    checked,
    loginDay,
    loginDayList,
    formatLoginDayOptions,
    syncRememberToStore
  };
}
