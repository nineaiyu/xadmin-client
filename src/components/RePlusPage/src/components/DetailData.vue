<script lang="ts" setup>
import { computed, ref } from "vue";
import {
  FieldValues,
  PlusColumn,
  PlusDescriptions,
  PlusForm
} from "plus-pro-components";
import { deviceDetection } from "@pureadmin/utils";

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

const formRef = ref();
const activeName = ref(0);
const newFormInline = ref<FieldValues>(props.formInline);
const column = computed(() => (deviceDetection() ? 1 : 2));
const formRefs = ref<Record<number, InstanceType<typeof PlusForm>>>({});

const isTabs = computed(() => {
  return (
    props.columns.length > 0 &&
    props.columns[0]._column?.tabs_index !== undefined
  );
});

const tabsColumns = computed(() => {
  const _tabsColumns = {};
  const _tabsLabels = {};
  props.columns.forEach(column => {
    const index = column._column.tabs_index;
    _tabsLabels[index] = column._column.tabs_label;
    if (_tabsColumns[index]) {
      _tabsColumns[index].push(column);
    } else {
      _tabsColumns[index] = [column];
    }
  });
  const result = [];
  for (let i = 0; i < Object.keys(_tabsLabels).length; i++) {
    result.push({
      label: _tabsLabels[i],
      index: i,
      columns: _tabsColumns[i]
    });
  }
  return result;
});

const setFormRef = (el: any, index: number) => {
  if (el) {
    formRefs.value[index] = el;
  }
};
const setActiveName = (index: number) => {
  activeName.value = index;
};

function getRef() {
  if (isTabs.value) {
    const instance = formRefs.value[activeName.value]?.formInstance;

    (instance as any)._allInstances = Object.keys(formRefs.value)
      .map(Number)
      .sort((a, b) => a - b)
      .map(key => formRefs.value[key]?.formInstance);
    return instance;
  }

  return formRef.value?.formInstance;
}

defineExpose({ getRef, setActiveName });
</script>

<template>
  <div>
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
