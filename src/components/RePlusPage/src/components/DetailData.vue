<script lang="ts" setup>
import { computed, ref } from "vue";
import {
  FieldValues,
  PlusColumn,
  PlusDescriptions,
  PlusForm
} from "plus-pro-components";
import { deviceDetection } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import type { ExposedFormInstance } from "../utils/types";

defineOptions({ name: "DetailData" });

interface DetailFormProps {
  formInline?: FieldValues;
  formProps?: object;
  tabsProps?: object;
  columns?: PlusColumn[];
}

const props = withDefaults(defineProps<DetailFormProps>(), {
  formInline: () => ({}),
  formProps: () => ({}),
  tabsProps: () => ({}),
  columns: () => []
});

const { t } = useI18n();
const formRef = ref();
const activeName = ref(0);
const newFormInline = ref<FieldValues>(props.formInline);
const column = computed(() => (deviceDetection() ? 1 : 2));
const formRefs = ref<Record<number, InstanceType<typeof PlusForm>>>({});

/**
 * 详情数据是否「整行皆空」：字段权限启用且未给当前菜单配白名单时，
 * 序列化器会把字段裁空（未配置 = 裁空，运行时不可见），用户看到的是一块空白。
 * 这里给出可读解释，避免误判为数据丢失（白名单是部署前提，见 docs/architecture/permission.md）。
 */
const isBlankDetail = computed(() => {
  // 真实空记录同样有空值：只有「行对象缺少详情列的绝大部分键」才像字段权限裁空
  const row = newFormInline.value ?? {};
  const keys = Object.keys(row);
  const expected = props.columns
    .map(column => column.prop)
    .filter((prop): prop is string => Boolean(prop));
  if (!keys.length || !expected.length) return false;
  const present = expected.filter(prop => keys.includes(prop)).length;
  return present < expected.length;
});

const isTabs = computed(() =>
  props.columns.some(column => column._column?.tabs_index !== undefined)
);

const tabsColumns = computed(() => {
  const explicit = props.columns
    .map(column => column._column?.tabs_index)
    .filter((index): index is number => typeof index === "number");
  const first = explicit.length ? Math.min(...explicit) : 0;
  const indices = Array.from(new Set([first, ...explicit])).sort(
    (a, b) => a - b
  );
  const _tabsColumns: Record<number, typeof props.columns> = {};
  const _tabsLabels: Record<number, string> = {};
  props.columns.forEach(column => {
    // 页面注入的扩展列没有 tabs_index：并入第一个页签，而不是生成 undefined 分组
    const index = column._column?.tabs_index ?? first;
    if (column._column?.tabs_label) {
      _tabsLabels[index] = column._column.tabs_label;
    }
    (_tabsColumns[index] ??= []).push(column);
  });
  return indices.map((index, order) => ({
    label: _tabsLabels[index] ?? String(order + 1),
    index: order,
    columns: _tabsColumns[index]
  }));
});

const setFormRef = (el: unknown, index: number) => {
  if (el) {
    formRefs.value[index] = el as InstanceType<typeof PlusForm>;
  }
};
const setActiveName = (index: number) => {
  activeName.value = index;
};

function getRef() {
  if (isTabs.value) {
    const instance = formRefs.value[activeName.value]?.formInstance as
      ExposedFormInstance | undefined;

    if (instance) {
      instance._allInstances = Object.keys(formRefs.value)
        .map(Number)
        .sort((a, b) => a - b)
        .map(key => formRefs.value[key]?.formInstance as ExposedFormInstance);
    }
    return instance;
  }

  return formRef.value?.formInstance;
}

defineExpose({ getRef, setActiveName });
</script>

<template>
  <div>
    <el-alert
      v-if="isBlankDetail"
      class="mb-3"
      :closable="false"
      :title="t('plus.detailBlankTitle')"
      :description="t('plus.detailBlankTip')"
      type="warning"
    />
    <el-tabs v-if="isTabs" v-model="activeName" v-bind="tabsProps">
      <el-tab-pane
        v-for="tabs in tabsColumns"
        :key="tabs.index"
        :label="tabs.label"
        :name="tabs.index"
      >
        <PlusDescriptions
          :ref="el => setFormRef(el, tabs.index)"
          :column="column"
          :columns="tabs.columns"
          :data="newFormInline"
          v-bind="formProps"
        />
      </el-tab-pane>
    </el-tabs>
    <PlusDescriptions
      v-else
      ref="formRef"
      :column="column"
      :columns="columns"
      :data="newFormInline"
      v-bind="formProps"
    />
  </div>
</template>
