/** 大屏/设计器时钟文本：跟随当前界面语言（24 小时制） */
export function formatScreenClock(locale: string): string {
  return new Date().toLocaleTimeString(locale, { hour12: false });
}
