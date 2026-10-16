import { computed, ref } from "vue";
import { useGlobal } from "@pureadmin/utils";
import {
  DEFAULT_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_RANGE,
  normalizeSidebarWidth
} from "@/layout/hooks/usePreferenceAttributes";
import { useConfigureStorage } from "../components/lay-setting/hooks/useConfigureStorage";

/**
 * 侧栏拖拽调宽（设置面板 →「侧栏拖拽」，默认关）：拖拽中只改 `--sidebar-width`
 * CSS 变量不落库，松开时才写回偏好（钳制在区间内，数字输入档仍可精确设置）。
 * 指针越过可调区间时给 `not-allowed` 光标与越界标记（视觉反馈，
 * 拖拽的边界态）。
 *
 * @param enabled 是否允许拖拽（侧栏展开 + 开关开启 + 非移动端的响应式取值）
 */
export function useSidebarResize(enabled: () => boolean) {
  const { $storage } = useGlobal<GlobalPropertiesApi>();
  const { storageConfigureChange } = useConfigureStorage();

  const resizing = ref(false);
  const resizeOutOfRange = ref(false);
  const draggable = computed(() => enabled());

  function startResize(event: MouseEvent) {
    if (resizing.value) return;
    resizing.value = true;
    const startX = event.clientX;
    const startWidth = normalizeSidebarWidth(
      $storage?.configure?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH
    );
    const rawWidthAt = (clientX: number) => startWidth + (clientX - startX);
    const widthAt = (clientX: number) =>
      normalizeSidebarWidth(rawWidthAt(clientX));

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onMove = (moveEvent: MouseEvent) => {
      const raw = rawWidthAt(moveEvent.clientX);
      const outOfRange =
        raw < SIDEBAR_WIDTH_RANGE.min || raw > SIDEBAR_WIDTH_RANGE.max;
      if (outOfRange !== resizeOutOfRange.value) {
        resizeOutOfRange.value = outOfRange;
        document.body.style.cursor = outOfRange ? "not-allowed" : "col-resize";
      }
      document.documentElement.style.setProperty(
        "--sidebar-width",
        `${widthAt(moveEvent.clientX)}px`
      );
    };
    const onUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      resizing.value = false;
      resizeOutOfRange.value = false;
      storageConfigureChange("sidebarWidth", widthAt(upEvent.clientX));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return { draggable, resizing, resizeOutOfRange, startResize };
}
