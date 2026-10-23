import { watch, type Ref } from "vue";

/** 联动隐藏字段的值暂存：隐藏时移出载荷，恢复显示时回填用户输入 */
export function useHiddenStash(
  controls: Ref<Record<string, { hidden?: boolean }>>,
  formData: Record<string, unknown>
) {
  const stash = new Map<string, unknown>();
  watch(
    controls,
    value => {
      for (const [key, control] of Object.entries(value)) {
        if (control.hidden) {
          if (key in formData) {
            stash.set(key, formData[key]);
            delete formData[key];
          }
        } else if (stash.has(key)) {
          formData[key] = stash.get(key);
          stash.delete(key);
        }
      }
    },
    { immediate: true }
  );
}
