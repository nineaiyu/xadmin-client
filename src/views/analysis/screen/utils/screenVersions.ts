import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import { rollbackScreen, type ScreenItem } from "@/api/dataset/analysis";
import { normalizeError } from "@/utils/apiError";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 大屏历史布局动作：回滚到指定版本并返回服务端最新大屏。
 *
 * 只更新主表状态，两份画布载荷如何装进编辑器由设计器决定；独立成文件以
 * 守住 hook 行数门禁。
 */
export function createScreenVersionActions(deps: {
  t: TFunction;
  screen: Ref<ScreenItem | null>;
  saving: Ref<boolean>;
  readonly: Ref<boolean>;
  preview: Ref<boolean>;
}) {
  async function rollbackTo(version: number): Promise<ScreenItem | null> {
    const { screen, saving, readonly, preview } = deps;
    if (!screen.value || saving.value || readonly.value || preview.value)
      return null;
    saving.value = true;
    try {
      const res = await rollbackScreen(screen.value.pk, version).catch(
        normalizeError
      );
      if (isSuccess(res) && res.data) {
        screen.value = { ...screen.value, ...res.data };
        return screen.value;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      return null;
    } finally {
      saving.value = false;
    }
  }

  return { rollbackTo };
}
