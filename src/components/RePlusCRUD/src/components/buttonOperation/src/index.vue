<template>
  <template
    v-for="buttonRow in getSubButtons().preButtons"
    :key="buttonRow.code"
  >
    <component :is="() => render(row, buttonRow)" />
  </template>

  <!-- 隐藏的按钮 -->
  <el-dropdown v-if="getSubButtons().showMore" trigger="click">
    <el-button
      :icon="useRenderIcon(More)"
      :size="size"
      class="ml-3 mt-[2px]"
      link
      type="primary"
    />

    <!-- 下拉按钮 -->
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="buttonRow in getSubButtons().nextButtons"
          :key="unref(buttonRow.code) as string"
        >
          <component :is="() => render(row, buttonRow)" />
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script lang="ts" setup>
import type { Component, VNode } from "vue";
import { h, unref, computed } from "vue";
import { ElPopconfirm, ElTooltip } from "element-plus";
import {
  ElButton,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu
} from "element-plus";
import { RecordType } from "plus-pro-components";
import { isFunction } from "@pureadmin/utils";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import More from "@iconify-icons/ep/more-filled";
import { OperationButtonsRow, OperationEmits, OperationProps } from "./types";

const emit = defineEmits<OperationEmits>();

defineOptions({
  name: "buttonOperation"
});

const props = withDefaults(defineProps<OperationProps>(), {
  text: undefined,
  size: "default",
  row: () => ({}),
  buttons: () => [],
  showNumber: 3
});

const uniqueButtons = computed(() => {
  const b = {};
  props.buttons.forEach(item => {
    b[item.code] = item;
  });
  return Object.values(b);
});

const getSubButtons = () => {
  const data: OperationButtonsRow[] = uniqueButtons.value.filter(
    (item: OperationButtonsRow) => {
      return unref(item.show) !== false;
    }
  );
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

// 渲染
const render = (row: RecordType, buttonRow: OperationButtonsRow): VNode => {
  const buttonComponent = h(
    ElButton,
    {
      size: props.size,
      ...buttonRow.props,
      onClick: buttonRow.confirm?.title
        ? undefined
        : (event: MouseEvent) => handleClickAction(row, buttonRow, event)
    },
    buttonRow?.text
      ? () => {
          return unref(buttonRow.text);
        }
      : {}
  );
  if (buttonRow.confirm?.title) {
    return h(
      ElPopconfirm as Component,
      {
        title: buttonRow.confirm?.title,
        onConfirm: (event: MouseEvent) =>
          handleClickAction(row, buttonRow, event),
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
        content: buttonRow.tooltip?.content,
        ...buttonRow.tooltip?.props
      },
      () => buttonComponent
    );
  }
  return buttonComponent;
};

// 分发按钮事件
const handleClickAction = (
  row: RecordType,
  buttonRow: OperationButtonsRow,
  e: MouseEvent
) => {
  const callbackParams = {
    row,
    buttonRow,
    e
  };

  if (buttonRow.onClick && isFunction(buttonRow.onClick)) {
    buttonRow.onClick(callbackParams);
  }
  emit("clickAction", callbackParams);
};
</script>
