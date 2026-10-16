import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  type CSSProperties
} from "vue";

import {
  readFabPosition,
  writeFabPosition,
  type FabPosition
} from "../utils/fabPosition";
import { createFabDragSession } from "../utils/fabDragSession";

/**
 * 悬浮球拖拽（右下角设置入口）：按住可拖到视口任意位置，位置存本地偏好
 * （见 `utils/fabPosition`），窗口尺寸变化时把人拖出视口的历史位置拉回来。
 *
 * 本 hook 只负责「状态 + 生命周期」接线：指针事件编排在
 * `utils/fabDragSession`（位移阈值内视为点击、超过则落库位置且不打开面板，
 * 键盘 Enter / Space 走同一入口）。
 */
export function useFabDrag(onActivate: () => void) {
  const position = ref<FabPosition | null>(readFabPosition());
  const dragging = ref(false);

  const style = computed<CSSProperties>(() => {
    const value = position.value;
    if (!value) return {};
    // 有记录时以 left/top 绝对定位，必须清掉默认的 right/bottom
    return {
      left: `${value.x}px`,
      top: `${value.y}px`,
      right: "auto",
      bottom: "auto"
    };
  });

  const session = createFabDragSession({
    onMove: value => {
      position.value = value;
    },
    onDrop: value => {
      writeFabPosition(value);
    },
    onActivate,
    onDragStateChange: value => {
      dragging.value = value;
    }
  });

  /** 视口变化后把球拉回可见区域（横竖屏切换 / 浏览器窗口缩放） */
  function reclamp() {
    if (!position.value) return;
    position.value = session.clamp(position.value);
  }

  onMounted(() => {
    reclamp();
    window.addEventListener("resize", reclamp);
  });

  onBeforeUnmount(() => {
    session.detach();
    window.removeEventListener("resize", reclamp);
  });

  return {
    /** 已保存的绝对位置（null = 默认右下角） */
    position,
    dragging,
    /** 绑定到球体的内联样式 */
    style,
    onPointerDown: session.onPointerDown,
    /** 键盘触发（Enter / Space）与点击同一入口 */
    onActivate
  };
}
