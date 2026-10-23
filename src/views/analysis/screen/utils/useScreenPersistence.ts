import { useConfirm } from "@/hooks/useConfirm";
import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import {
  screenApi,
  type ScreenItem,
  type ScreenLayoutPane
} from "@/api/dataset/analysis";
import { normalizePanes } from "./layout";
import { normalizeError } from "@/utils/apiError";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 设计器的落库动作：保存（画布载荷 + 模式 + 主题）与清空当前模式载荷。
 *
 * 主题是表单级属性（与画布载荷同一请求提交）；撤销栈只覆盖画布操作，
 * 保存成功后仅重置拖拽合并窗口，不清空历史。
 */
export function useScreenPersistence(options: {
  t: TFunction;
  screen: Ref<ScreenItem | null>;
  saving: Ref<boolean>;
  dirty: Ref<boolean>;
  readonly: Ref<boolean>;
  /** 预览态：与只读同锁，禁止清空/保存类破坏动作 */
  preview: Ref<boolean>;
  isFree: Ref<boolean>;
  activePanes: Ref<ScreenLayoutPane[]>;
  gridPanes: Ref<ScreenLayoutPane[]>;
  freePanes: Ref<ScreenLayoutPane[]>;
  /** 当前主题（标量，供写入载荷） */
  theme: () => { theme: string; theme_color: string };
  /** 自由画布载荷（含基准设计画幅） */
  freePayload: () => unknown;
  pushHistory: () => void;
  resetCoalesce: () => void;
  clearSelection: () => void;
}) {
  const { t } = options;
  const confirm = useConfirm();

  async function save() {
    const { screen, saving, readonly, dirty } = options;
    if (!screen.value || saving.value || readonly.value) return;
    saving.value = true;
    try {
      // 只写当前模式的载荷（另一模式原样保留；服务端校验「载荷与模式」的对应关系）
      const payload = {
        ...(options.isFree.value
          ? { layout_mode: "free" as const, free_layout: options.freePayload() }
          : {
              layout_mode: "grid" as const,
              layout: normalizePanes(options.gridPanes.value)
            }),
        ...options.theme()
      };
      const res = await screenApi
        .partialUpdate(screen.value.pk, payload)
        .catch(normalizeError);
      if (isSuccess(res)) {
        dirty.value = false;
        options.resetCoalesce();
        message(t("dataScreen.layoutSaved"), { type: "success" });
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
    } finally {
      saving.value = false;
    }
  }

  /** 清空当前模式的载荷（另一模式的载荷保留，切回即可见） */
  async function clearCanvas() {
    const { isFree, activePanes, readonly, preview, gridPanes, freePanes } =
      options;
    if (activePanes.value.length === 0 || readonly.value || preview.value)
      return;
    const prompt = isFree.value
      ? t("dataScreen.freeClearConfirm")
      : t("dataScreen.clearLayoutConfirm");
    if (!(await confirm(prompt, { title: t("dataScreen.clearLayout") }))) {
      return;
    }
    options.pushHistory();
    if (isFree.value) freePanes.value = [];
    else gridPanes.value = [];
    options.clearSelection();
  }

  return { save, clearCanvas };
}
