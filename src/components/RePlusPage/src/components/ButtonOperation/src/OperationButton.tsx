/**
 * 单个操作按钮（稳定组件引用）。
 *
 * 为什么必须独立成组件：原实现用 `<component :is="() => render(row, buttonRow)">`
 * ——每次重渲染都会产生**新的函数引用**，Vue 视为「动态组件类型变化」→ 卸载并重建
 * 整棵子树。在「更多」下拉内，鼠标移入/移出会使 `el-dropdown-item` 的 hover 状态
 * 变化触发重渲染，于是带 confirm（ElPopconfirm）的按钮会被重建——确认框刚打开就
 * 因组件销毁而消失（用户移动鼠标即触发）。组件引用稳定后，重渲染只做 props 更新。
 */
import {
  defineComponent,
  h,
  nextTick,
  ref,
  unref,
  type Component,
  type ComputedRef,
  type PropType,
  type Ref,
  type VNode
} from "vue";
import { ElButton, ElPopconfirm, ElTooltip } from "element-plus";
import { isFunction } from "@pureadmin/utils";
import type { RecordType } from "plus-pro-components";
import type { OperationButtonsRow } from "./types";

export default defineComponent({
  name: "OperationButton",
  props: {
    row: { type: Object as PropType<RecordType>, required: true },
    buttonRow: {
      type: Object as PropType<OperationButtonsRow>,
      required: true
    },
    size: {
      type: String as PropType<"" | "default" | "small" | "large">,
      default: "default"
    },
    /** 「更多」下拉内的按钮：交互结束（确认/取消/点击）后需收起下拉 */
    isSubButton: { type: Boolean, default: false },
    /** 收起「更多」下拉（父组件提供，引用稳定） */
    closeDropdown: {
      type: Function as PropType<() => void>,
      default: undefined
    }
  },
  emits: ["action"],
  setup(props, { emit }) {
    const loading = ref(false);
    // 确认框收起完成后再关下拉（见 onAfterLeave）：两者并发会让确认框
    // 因 reference 突然消失而定位跳变（视觉卡顿）
    /**
     * 确认框淡出后再收起「更多」下拉。
     *
     * reference（按钮）在下拉内，立即收起下拉会让确认框关闭动画失去定位基准而
     * 跳变（视觉卡顿）；等 popover 淡出动画（约 200ms）结束再收，顺序清晰。
     * 用固定延时而非 after-leave 事件：popconfirm 内部对 el-tooltip 的透传链
     * 不消费 before-enter/after-enter/after-leave（实测不触发，同 onShow 之坑）。
     */
    const closeDropdownAfterConfirm = () => {
      if (!props.isSubButton) return;
      setTimeout(() => props.closeDropdown?.(), 260);
    };

    /**
     * 确认框 popper 内的事件不冒泡到 document。
     *
     * 确认框按钮的 reference 位于「更多」下拉内，而 EP 的 click-outside 监听
     * document 的 mousedown/mouseup/pointerdown 等（bubble 阶段）——点击「确定/取消」
     * 会被判定为「下拉外部点击」而立即收起下拉，reference 随之消失导致确认框
     * 关闭动画失去定位基准而跳变（视觉卡顿）。此处只拦截确认框 popper 内的交互
     * 事件，按钮自身的 click 处理器（target 阶段）不受影响。
     *
     * 注意不能用 popper-class 定位：popconfirm 内部渲染 el-tooltip 时该属性是
     * 硬编码的（`popper-class: "el-popover"` 在 $attrs 之后展开，会覆盖调用方传值），
     * 只能按公开类名 `.el-popconfirm` 反查其 popper 容器。
     */
    const guardConfirmPopper = () => {
      nextTick(() => {
        const poppers = Array.from(document.querySelectorAll(".el-popconfirm"))
          .map(node => node.closest<HTMLElement>(".el-popper"))
          .filter(
            (el): el is HTMLElement =>
              !!el && el.getBoundingClientRect().width > 0
          );
        const popper = poppers.find(el => !el.dataset.confirmGuard);
        if (!popper) return;
        popper.dataset.confirmGuard = "1";
        const stop = (e: Event) => e.stopPropagation();
        ["mousedown", "mouseup", "click", "pointerdown", "pointerup"].forEach(
          evt => popper.addEventListener(evt, stop)
        );
      });
    };

    const renderString = (
      str: OperationButtonsRow["text"],
      row: RecordType,
      buttonRow: OperationButtonsRow
    ) => {
      if (typeof str === "function") {
        const tempFunction = str as (
          _row: RecordType,
          _button: OperationButtonsRow
        ) => string | Ref<string> | ComputedRef<string>;
        const text = tempFunction(row, buttonRow);
        return unref(text);
      } else {
        return unref(str);
      }
    };

    // 对外契约不变：onClick 回调参数里的 loading 支持 .value 读写
    const loadingHolder = {
      get value(): boolean {
        return loading.value;
      },
      set value(value: boolean) {
        loading.value = value;
      }
    };

    const handleClickAction = (e: MouseEvent) => {
      const callbackParams = {
        e,
        row: props.row,
        buttonRow: props.buttonRow,
        loading: loadingHolder
      };
      if (props.buttonRow.onClick && isFunction(props.buttonRow.onClick)) {
        props.buttonRow.onClick(callbackParams);
      }
      emit("action", callbackParams);
    };

    const closeDropdownIfSub = () => {
      if (props.isSubButton) props.closeDropdown?.();
    };

    return (): VNode => {
      const { row, buttonRow } = props;
      const buttonRowProps = isFunction(buttonRow.props)
        ? buttonRow.props(row, buttonRow)
        : unref(buttonRow.props);

      // icon-only 按钮补可访问名（a11y）：无 text 时取 tooltip 文案；显式 aria-label 优先
      const explicitAriaLabel = (buttonRowProps as Record<string, unknown>)?.[
        "aria-label"
      ];
      const tooltipContent = buttonRow.tooltip?.content
        ? renderString(buttonRow.tooltip.content, row, buttonRow)
        : undefined;
      const ariaLabel =
        explicitAriaLabel ??
        (!buttonRow?.text && tooltipContent ? tooltipContent : undefined);

      const buttonComponent = h(
        ElButton,
        {
          size: props.size,
          loading: loading.value,
          ...buttonRowProps,
          ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
          onClick: buttonRow.confirm?.title
            ? undefined
            : (event: MouseEvent) => {
                handleClickAction(event);
                closeDropdownIfSub();
              }
        },
        buttonRow?.text
          ? () => {
              return renderString(buttonRow.text, row, buttonRow);
            }
          : {}
      );

      if (buttonRow.confirm?.title) {
        return h(
          ElPopconfirm as Component,
          {
            title: renderString(buttonRow.confirm?.title, row, buttonRow),
            // 显式 click 触发：popconfirm 继承 tooltip/popover 的 trigger 默认值是 hover，
            // 鼠标一离开触发按钮（移向确认框的途中）确认框即关闭。
            trigger: "click",
            // run onShow: popconfirm 内部对 el-tooltip 硬编码了 onShow（focus 处理），
            // Vue 的 mergeProps 对同名事件是合并数组（二者都会执行），是唯一可靠的
            // 「打开时」钩子；before-enter/after-enter 在透传链中不被消费（实测不触发）
            onShow: guardConfirmPopper,
            onConfirm: (event: MouseEvent) => {
              handleClickAction(event);
              closeDropdownAfterConfirm();
            },
            onCancel: (event: MouseEvent) => {
              // 点击「更多」内其他项导致本确认框关闭时（target 在下拉面板内），
              // 保持下拉打开——否则会连带关掉刚打开的那个确认框；
              // 点击「取消」或面板外关闭确认框时，待确认框淡出后再收起下拉
              const target = event?.target as HTMLElement | undefined;
              if (target?.closest?.(".el-dropdown__popper")) return;
              closeDropdownAfterConfirm();
            },
            ...buttonRow.confirm?.props
          },
          { reference: () => buttonComponent }
        );
      }
      if (buttonRow.tooltip?.content) {
        return h(
          ElTooltip,
          {
            placement: "top",
            content: tooltipContent,
            ...buttonRow.tooltip?.props
          },
          () => buttonComponent
        );
      }
      return buttonComponent;
    };
  }
});
