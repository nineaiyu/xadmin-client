import "./index.css";
import resizer from "./resizer";
import {
  type PropType,
  defineComponent,
  computed,
  onBeforeUnmount,
  ref
} from "vue";

export interface ContextProps {
  /** 双侧最小百分比边界（左栏不得小于 minPercent，右栏同理） */
  minPercent: number;
  /** 重置按钮/双击分隔条恢复到的默认百分比 */
  defaultPercent: number;
  /** vertical = 左右分栏，horizontal = 上下分栏 */
  split: "vertical" | "horizontal";
}

/**
 * 可拖拽分栏容器（移植自 vue-pure-admin ReSplitPane，增强点）：
 * - 受控模式：宽度比例由 v-model:percent 外部持有（便于持久化），拖拽中实时
 *   emit("update:percent")，拖拽结束 emit("drag-end") 供外部保存；
 * - 重置：双击分隔条或点击分隔条上的悬浮按钮，恢复 defaultPercent；
 * - 修正原版 onMousemove 依赖全局 event 的问题；拖拽期容器覆盖透明 mask
 *   防止划选文本。
 */
export default defineComponent({
  name: "ReSplitPane",
  components: { resizer },
  props: {
    splitSet: {
      type: Object as PropType<ContextProps>,
      required: true
    },
    /** 左栏（或上栏）宽度百分比，受控值 */
    percent: {
      type: Number,
      required: true
    }
  },
  emits: ["update:percent", "resize", "drag-end", "reset"],
  setup(props, ctx) {
    /**
     * 按下态：mousedown 即点亮，驱动防划选遮罩与 body 选区锁。
     * 必须与「位移是否超阈值」解耦——若等超阈值才点亮，按下到点亮之间存在
     * 窗口期，浏览器已按原生语义开始划选右侧内容（用户感知为"拖分隔条却在
     * 选右栏文本"），且高亮在松手后残留。
     */
    const pressed = ref(false);
    /** 位移已超阈值，确认是拖拽（驱动拖拽光标；点击按钮不切换光标） */
    const dragging = ref(false);
    /** 等待位移判定是「点击」还是「拖拽」 */
    let armed = false;
    /** 本次按下的起点是否落在中央重置按钮上（未拖动时 = 点击重置） */
    let fromButton = false;
    /** 拖拽起点（位移阈值判定用） */
    const downX = ref(0);
    const downY = ref(0);
    /** 位移小于该值视为点击而非拖拽 */
    const MOVE_THRESHOLD_PX = 2;

    const type = props.splitSet.split === "vertical" ? "width" : "height";

    /** 拖拽期间给 body 加类：CSS 全局禁选，覆盖鼠标移出容器后继续划选的缝隙 */
    const DRAGGING_BODY_CLASS = "splitter-dragging";
    const lockSelection = () =>
      document.body.classList.add(DRAGGING_BODY_CLASS);
    const unlockSelection = () =>
      document.body.classList.remove(DRAGGING_BODY_CLASS);

    const cursor = computed(() => {
      return dragging.value
        ? props.splitSet.split === "vertical"
          ? { cursor: "col-resize" }
          : { cursor: "row-resize" }
        : { cursor: "default" };
    });

    const applyPercent = (value: number) => {
      ctx.emit("update:percent", value);
      ctx.emit("resize", value);
    };

    const resetPercent = () => {
      applyPercent(props.splitSet.defaultPercent);
      ctx.emit("reset", props.splitSet.defaultPercent);
      ctx.emit("drag-end", props.splitSet.defaultPercent);
    };

    const onResizerMouseDown = (e: MouseEvent): void => {
      if (e.button !== 0) return;
      armed = true;
      dragging.value = false;
      pressed.value = true;
      lockSelection();
      // 按钮区域同样可作拖拽起点（分隔条中央最顺手），是否「点击重置」
      // 留到 mouseup 用位移阈值判定
      fromButton = !!(e.target as HTMLElement).closest(".splitter-reset-btn");
      downX.value = e.pageX;
      downY.value = e.pageY;
      // mouseup 兜底挂 window：拖拽中鼠标移出容器边界后 mask 不再覆盖，
      // 容器收不到 mouseup，若只监听容器会在"外部松手"场景丢失 drag-end
      // （percent 已实时变化但配置永不落盘）。once 自动清理，无需手动解绑。
      window.addEventListener("mouseup", finishPointer, { once: true });
    };

    /**
     * 结束本次按下：位移已超阈值 → 拖拽结束（emit drag-end 触发保存）；
     * 未拖动且起点在中央按钮上 → 视为点击按钮，恢复默认比例。
     */
    const finishPointer = (): void => {
      if (!armed) return;
      armed = false;
      const moved = dragging.value;
      dragging.value = false;
      pressed.value = false;
      unlockSelection();
      if (moved) {
        ctx.emit("drag-end", props.percent);
      } else if (fromButton) {
        resetPercent();
      }
      fromButton = false;
    };

    // 组件在按下/拖拽途中被卸载（如切换路由）时兜底解锁选区
    onBeforeUnmount(() => {
      unlockSelection();
    });

    const onMouseMove = (e: MouseEvent): void => {
      // 极端兜底：alt-tab 等场景 window mouseup 不派发，鼠标回到容器内
      // 一旦探测到按键已松开则按拖拽结束处理（补发 drag-end 保存配置）
      if (e.buttons === 0) {
        if (armed) {
          finishPointer();
        }
        return;
      }
      if (!armed) return;

      // 位移阈值：按下与抬起之间的同点位微小 mousemove（真实点击几乎必有）
      // 不算拖拽——既避免点击重置按钮被误判为拖拽，也不产生无意义的宽度闪变
      if (!dragging.value) {
        if (
          Math.abs(e.pageX - downX.value) < MOVE_THRESHOLD_PX &&
          Math.abs(e.pageY - downY.value) < MOVE_THRESHOLD_PX
        ) {
          return;
        }
        dragging.value = true;
      }

      let offset = 0;
      let target = e.currentTarget as HTMLElement | null;
      const vertical = props.splitSet.split === "vertical";
      while (target) {
        offset += vertical ? target.offsetLeft : target.offsetTop;
        target = target.offsetParent as HTMLElement | null;
      }

      const container = e.currentTarget as HTMLElement;
      const currentPage = vertical ? e.pageX : e.pageY;
      const totalOffset = vertical
        ? container.offsetWidth
        : container.offsetHeight;
      const percents =
        Math.floor(((currentPage - offset) / totalOffset) * 10000) / 100;

      if (
        percents > props.splitSet.minPercent &&
        percents < 100 - props.splitSet.minPercent
      ) {
        applyPercent(percents);
      }
    };

    return () => (
      <div
        class="vue-splitter-container clearfix"
        style={cursor.value}
        onMousemove={(e: MouseEvent) => onMouseMove(e)}
      >
        <div
          class={`splitter-pane splitter-paneL ${props.splitSet.split}`}
          style={{ [type]: `${props.percent}%` }}
        >
          {ctx.slots.paneL?.()}
        </div>
        <resizer
          split={props.splitSet.split}
          onMousedown={(e: MouseEvent) => onResizerMouseDown(e)}
          onDblclick={() => resetPercent()}
        ></resizer>
        <div class={`splitter-pane splitter-paneR ${props.splitSet.split}`}>
          {ctx.slots.paneR?.()}
        </div>
        <div v-show={pressed.value} class="vue-splitter-container-mask"></div>
      </div>
    );
  }
});
