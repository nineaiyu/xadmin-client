import { ref } from "vue";

/**
 * 锁屏状态（模块级单例）：顶栏锁屏按钮、锁屏遮罩、设置面板开关共享同一份状态。
 *
 * 只驻内存、不落存储：刷新页面即解锁——锁屏是「临时离席遮挡」，不是访问控制；
 * 真正的访问控制仍是登录态与后端鉴权。
 */
const isLocked = ref(false);
/** 锁屏时刻（毫秒），供遮罩显示锁屏时间 */
const lockedAt = ref(0);

export function useLockScreen() {
  function lock() {
    lockedAt.value = Date.now();
    isLocked.value = true;
  }

  function unlock() {
    isLocked.value = false;
  }

  return { isLocked, lockedAt, lock, unlock };
}
