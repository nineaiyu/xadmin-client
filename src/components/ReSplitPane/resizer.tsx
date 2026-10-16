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

    // 纯视觉组件：中央 ↺ 按钮是「点击重置」的视觉提示与实际命中区，
    // 是否重置/拖拽由 ReSplitPane 依据按下后的位移阈值统一判定——
    // 按钮自身不挂 click，否则「从按钮按住拖动」在松开时会误触发重置。
    return () => (
      <div class={classes.value}>
        <span class="splitter-reset-btn" title={t("buttons.splitPaneReset")}>
          <svg viewBox="0 0 24 24" width="12" height="12">
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
