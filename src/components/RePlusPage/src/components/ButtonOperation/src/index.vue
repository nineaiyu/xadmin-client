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
            :class="buttonClass"
            @action="handleChildAction"
          />
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script lang="ts" setup>
import type { Ref, ComputedRef } from "vue";
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
import { uniqueArrayObj } from "@/components/RePlusPage";
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
  const data = (uniqueButtons.value as OperationButtonsRow[])
    .filter((item: OperationButtonsRow) => {
      if (typeof item.show === "function") {
        const tempFunction = item.show as (
          _row: RecordType,
          _button: OperationButtonsRow
        ) =>
          | number
          | boolean
          | Ref<number | boolean>
          | ComputedRef<number | boolean>;
        item.index = Number(unref(tempFunction(props.row, item)));
        return Boolean(item.index) === true;
      }
      item.index = Number(unref(item.show));
      return Boolean(item.index) === true;
    })
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
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

const buttonClass = computed(() => {
  return [
    "h-[20px]!",
    "reset-margin",
    "text-gray-500!",
    "dark:text-white!",
    "dark:hover:text-primary!"
  ];
});

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
