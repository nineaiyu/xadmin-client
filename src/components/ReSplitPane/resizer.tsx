import "./resizer.css";
import { computed, defineComponent } from "vue";
import { useI18n } from "vue-i18n";

export default defineComponent({
  name: "Resizer",
  props: {
    split: {
      type: String,
      required: true
    },
    percent: {
      type: Number,
      default: 50
    },
    onNudge: {
      type: Function,
      default: undefined
    },
    className: {
      type: String,
      default: ""
    }
  },
  setup(props) {
    const { t } = useI18n();
    const classes = computed(() => {
      return ["splitter-pane-resizer", props.split, props.className].join(" ");
    });

    // 纯视觉提示：重置按钮不单独可聚焦/可点击，避免与分隔条的 separator 语义
    // 形成嵌套交互（axe nested-interactive）；点击由 ReSplitPane 的
    // mousedown/mouseup 阈值路径处理，键盘重置由分隔条的 Enter/Space 承担。
    const vertical = computed(() => props.split === "vertical");
    return () => (
      <div
        class={classes.value}
        role="separator"
        tabindex="0"
        aria-orientation={vertical.value ? "vertical" : "horizontal"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(props.percent)}
        onKeydown={(e: KeyboardEvent) => {
          const nudge = props.onNudge as
            ((event: KeyboardEvent) => void) | undefined;
          nudge?.(e);
        }}
      >
        <span
          class="splitter-reset-btn"
          aria-hidden="true"
          title={t("buttons.splitPaneReset")}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 5V2L7 6l5 4V7c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6c-1.78 0-3.37-.77-4.47-2h-2.4A8 8 0 1 0 12 5z"
            />
          </svg>
        </span>
      </div>
    );
  }
});
