<template>
  <template
    v-for="buttonRow in getSubButtons().preButtons"
    :key="buttonRow.code"
  >
    <component :is="() => render(row, buttonRow)" />
  </template>

  <!-- 隐藏的按钮 -->
  <el-dropdown v-if="getSubButtons().showMore">
    <el-button
      :icon="useRenderIcon(More)"
      :size="size"
      class="ml-3! mt-[2px]"
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
          <component :is="() => render(row, buttonRow)" :class="buttonClass" />
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script lang="ts" setup>
import type { Component, VNode, Ref, ComputedRef } from "vue";
import { h, unref, computed, ref } from "vue";
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
import More from "~icons/ep/more-filled";
import { OperationButtonsRow, OperationEmits, OperationProps } from "./types";
import { uniqueArrayObj } from "@/components/RePlusPage";

const emit = defineEmits<OperationEmits>();

defineOptions({
  name: "ButtonOperation"
});

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
    .sort((a, b) => a.index - b.index);
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

const buttonClass = computed(() => {
  return [
    "h-[20px]!",
    "reset-margin",
    "text-gray-500!",
    "dark:text-white!",
    "dark:hover:text-primary!"
  ];
});

const buttonLoadings = ref({});

// 渲染
const render = (row: RecordType, buttonRow: OperationButtonsRow): VNode => {
  const buttonRowProps = isFunction(buttonRow.props)
    ? buttonRow.props(row, buttonRow)
    : unref(buttonRow.props);

  const buttonComponent = h(
    ElButton,
    {
      size: props.size,
      loading: buttonLoadings.value[buttonRow.code],
      ...buttonRowProps,
      onClick: buttonRow.confirm?.title
        ? undefined
        : (event: MouseEvent) => handleClickAction(row, buttonRow, event)
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
        content: renderString(buttonRow.tooltip?.content, row, buttonRow),
        ...buttonRow.tooltip?.props
      },
      () => buttonComponent
    );
  }
  return buttonComponent;
};

class Loading {
  private readonly code = undefined;
  private readonly loadings = undefined;

  constructor(code, loadings) {
    this.code = code;
    this.loadings = loadings;
  }

  //get 的用法
  get value(): boolean {
    return this.loadings[this.code];
  }

  // set 的用法
  set value(loading: boolean) {
    this.loadings[this.code] = loading;
  }
}

// 分发按钮事件
const handleClickAction = (
  row: RecordType,
  buttonRow: OperationButtonsRow,
  e: MouseEvent
) => {
  const callbackParams = {
    e,
    row,
    buttonRow,
    loading: new Loading(buttonRow.code, buttonLoadings.value)
  };
  if (buttonRow.onClick && isFunction(buttonRow.onClick)) {
    buttonRow.onClick(callbackParams);
  }
  emit("clickAction", callbackParams);
};
</script>
