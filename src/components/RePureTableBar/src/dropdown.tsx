import { computed, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { useEpThemeStoreHook } from "@/store/modules/epTheme";
import { buildDropdownItemStyle } from "./utils";

/**
 * 表格密度下拉（自 bar.tsx 抽出，控制单文件行数）：选中项用主题色高亮，
 * 选中后回调宿主（由宿主写入 size 并同步父组件 / 持久化偏好）。
 */
export function createSizeDropdown(options: {
  size: Ref<string>;
  /** 选中密度后的宿主处理（原逻辑：写 size + handleChange + persistPrefs） */
  onSizeChange: (event: MouseEvent, val: string) => void;
}) {
  const { t } = useI18n();
  const themeColor = computed(() => useEpThemeStoreHook().epThemeColor);
  const itemStyle = computed(() =>
    buildDropdownItemStyle(options.size, themeColor)
  );

  const selectSize = (event: MouseEvent, val: string) => {
    event.stopPropagation();
    options.onSizeChange(event, val);
  };

  /** el-dropdown 的 v-slots 形态 */
  const dropdown = {
    dropdown: () => (
      <el-dropdown-menu class="translation">
        <el-dropdown-item
          style={itemStyle.value("large")}
          onClick={event => selectSize(event, "large")}
        >
          {t("tableBar.loose")}
        </el-dropdown-item>
        <el-dropdown-item
          style={itemStyle.value("default")}
          onClick={event => selectSize(event, "default")}
        >
          {t("tableBar.default")}
        </el-dropdown-item>
        <el-dropdown-item
          style={itemStyle.value("small")}
          onClick={event => selectSize(event, "small")}
        >
          {t("tableBar.compact")}
        </el-dropdown-item>
      </el-dropdown-menu>
    )
  };

  return { dropdown };
}
