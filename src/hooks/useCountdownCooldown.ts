import { onBeforeUnmount, ref } from "vue";

/**
 * 发送验证码的倒计时冷却（登录 MFA 与全局二次验证共用）。
 *
 * - `start(seconds)` 从指定秒数起每秒递减，归零自动停止；
 * - 重复调用会重置计时器（重新发送即重新计时）；
 * - 组件卸载时清理计时器，避免定时器泄漏。
 */
export function useCountdownCooldown() {
  const cooldown = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start(seconds: number) {
    cooldown.value = seconds;
    stop();
    timer = setInterval(() => {
      cooldown.value -= 1;
      if (cooldown.value <= 0) stop();
    }, 1000);
  }

  onBeforeUnmount(stop);

  return { cooldown, start, stop };
}
