<template>
  <template
    v-for="buttonRow in getSubButtons().preButtons"
    :key="buttonRow.code"
  >
    <OperationButton
      :row="row"
      :button-row="buttonRow"
      :size="size"
      @action="handleChildAction"
    />
  </template>

  <!-- 隐藏的按钮（更多）：click 触发 + hide-on-click=false。
       hover 触发时鼠标移向二次确认框即离开下拉区域，下拉关闭会连带确认框消失；
       hide-on-click=false 则避免点击菜单项时立刻收起下拉。收起时机由子组件
       OperationButton 在交互完成（确认/取消/点击）后经 close-dropdown 回调控制。 -->
  <el-dropdown
    v-if="getSubButtons().showMore"
    ref="dropdownRef"
    trigger="click"
    :hide-on-click="false"
    popper-class="re-plus-more-dropdown"
  >
    <el-button
      :icon="useRenderIcon(More)"
      :size="size"
      class="ml-3! mt-0.5"
      link
      type="primary"
      :aria-label="t('layout.more')"
    />

    <!-- 下拉按钮 -->
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="buttonRow in getSubButtons().nextButtons"
          :key="unref(buttonRow.code)"
        >
          <OperationButton
            :row="row"
            :button-row="buttonRow"
            :size="size"
            is-sub-button
            :close-dropdown="closeDropdown"
            @action="handleChildAction"
          />
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script lang="ts" setup>
import { unref, computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu
} from "element-plus";
import { RecordType } from "plus-pro-components";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import More from "~icons/ep/more-filled";
import {
  ButtonsCallBackParams,
  OperationButtonsRow,
  OperationEmits,
  OperationProps
} from "./types";
import { uniqueArrayObj } from "../../../utils/index";
import OperationButton from "./OperationButton";

const emit = defineEmits<OperationEmits>();

defineOptions({
  name: "ButtonOperation"
});

// 「更多」下拉按钮（icon-only）的可访问名（a11y）
const { t } = useI18n();

const props = withDefaults(defineProps<OperationProps>(), {
  text: undefined,
  size: "default",
  row: () => ({}),
  buttons: () => [],
  showNumber: 3
});

const uniqueButtons = computed(() => uniqueArrayObj(props.buttons, "code"));

const getSubButtons = () => {
  // 显隐与排序解耦：显隐只看 show 的布尔值；排序位优先取显式声明的 index，
  // 未声明时兼容旧口径——show 为数值时数值即排序（`show: cond ? -30 : false`）。
  // 不再把解析结果回写进按钮配置（按行函数每行求值，回写会串行不同行的顺序）
  const data = (uniqueButtons.value as OperationButtonsRow[])
    .map((item: OperationButtonsRow) => {
      const resolved = unref(
        typeof item.show === "function"
          ? (
              item.show as (
                _row: RecordType,
                _button: OperationButtonsRow
              ) => unknown
            )(props.row, item)
          : item.show
      );
      return {
        item,
        order: item.index ?? (typeof resolved === "number" ? resolved : 0),
        visible: Boolean(resolved)
      };
    })
    .filter(entry => entry.visible)
    .sort((a, b) => a.order - b.order)
    .map(entry => entry.item);
  // 获取'更多'之前的按钮组
  const preButtons = data.slice(0, props.showNumber);
  // 获取'更多'之后的按钮组
  const nextButtons = data.slice(props.showNumber);
  //  显示更多
  const showMore = data.length > props.showNumber;
  return {
    showMore,
    preButtons,
    nextButtons
  };
};

// 「更多」下拉实例：hide-on-click=false 后由子组件在手势完成后回调收起
const dropdownRef = ref();

/** 收起「更多」下拉（子组件 close-dropdown 回调，引用稳定） */
const closeDropdown = () => {
  dropdownRef.value?.handleClose?.();
};

/** 子组件按钮事件转发（对外契约不变：clickAction） */
const handleChildAction = (params: ButtonsCallBackParams) => {
  emit("clickAction", params);
};
</script>

<style lang="scss">
/**
 * 「更多」下拉（操作列折叠动作）的菜单形态。
 *
 * popper 挂到 body，须用非 scoped 样式 + popper-class 限定作用域——只作用于本下拉，
 * 不碰 EP 全局 `.el-dropdown-menu`（顶栏「更多组件」/ 头像菜单另有 _header.scss 定制）。
 *
 * 设计要点：
 * 1. 菜单项以「圆角块」浮在面板内（靠自身 margin 内缩，避开全局对菜单 padding 的
 *    `!important` 清零），固定行高 34px、圆角、整行热区：动作绑在内层按钮上而 hover
 *    高亮作用于整行 `li`，故菜单项内各层一律撑满 →「可点区域 = 高亮区域 = 整行」；
 * 2. 层级：图标取次要色、文字取常规色，hover 整项转主色；危险动作（删除等）单项
 *    保持危险色并配淡化危险底色；
 * 3. `&.el-popper` 前缀用于提升特异性，压过 dark.scss 里 `html.dark` 下的下拉 hover 底色。
 */
.re-plus-more-dropdown {
  .el-dropdown-menu__item {
    height: 34px;
    padding: 0;
    margin: 2px var(--space-1);
    border-radius: var(--radius-md);
    transition: background-color var(--duration-hover) var(--ease-standard);

    > * {
      width: 100%;
    }

    .el-button {
      justify-content: flex-start;
      width: 100%;
      height: 100%;
      padding: 0 var(--space-3);
      font-size: var(--font-size-sm);
      font-weight: 400;
      color: var(--el-text-color-regular);
      border-radius: inherit;

      /* 图标：次要色 + 常规字号；左右间距只留 text span 的 margin-left（8px），
         清掉 EP 叠在 i 上的 5px，避免与 span 间距叠加成双倍 */
      [class*="el-icon"] {
        margin-right: 0;
        font-size: var(--font-size-base);
        color: var(--el-text-color-secondary);
        transition: color var(--duration-hover) var(--ease-standard);
      }

      [class*="el-icon"] + span {
        margin-left: var(--space-2);
      }
    }

    /* 无图标按钮的等宽占位：与有图标项的文字左边界对齐（菜单文字列不成锯齿） */
    .re-plus-more-action__icon-placeholder {
      display: inline-block;
      width: 1em;
      height: 1em;
    }
  }

  /* 面板本体：最小宽度统一（短文案菜单不至窄成一条），浮层阴影与卡片体系同源 */
  &.el-popper {
    min-width: 168px;
    max-width: 260px;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }

  /* hover / 键盘聚焦：整项高亮并转主色 */
  &.el-popper .el-dropdown-menu__item:not(.is-disabled):hover,
  &.el-popper .el-dropdown-menu__item:not(.is-disabled):focus {
    color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);

    .el-button {
      color: var(--el-color-primary);
    }

    [class*="el-icon"] {
      color: var(--el-color-primary);
    }
  }

  /* 危险动作：常态即危险色（类挂在按钮上，见 OperationButton 的 isSubButton 分支） */
  &.el-popper .el-dropdown-menu__item .el-button.is-danger {
    color: var(--el-color-danger);

    [class*="el-icon"] {
      color: var(--el-color-danger);
    }
  }

  /* 危险项 hover：底色改用淡化危险色，不随普通项转主色 */
  &.el-popper
    .el-dropdown-menu__item:has(.el-button.is-danger):not(.is-disabled):hover,
  &.el-popper
    .el-dropdown-menu__item:has(.el-button.is-danger):not(.is-disabled):focus {
    background-color: var(--el-color-danger-light-9);

    .el-button {
      color: var(--el-color-danger);
    }

    [class*="el-icon"] {
      color: var(--el-color-danger);
    }
  }
}
</style>
