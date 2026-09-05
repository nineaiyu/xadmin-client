<script lang="ts" setup>
import { computed, ref } from "vue";
import { FieldValues, PlusColumn, PlusForm } from "plus-pro-components";
import type { ExposedFormInstance } from "../utils/types";

defineOptions({ name: "AddOrEditForm" });

interface AddOrEditFormProps {
  formInline?: FieldValues;
  formProps?: object;
  tabsProps?: object;
  columns?: PlusColumn[];
}

const props = withDefaults(defineProps<AddOrEditFormProps>(), {
  formInline: () => ({}),
  formProps: () => ({}),
  tabsProps: () => ({}),
  columns: () => []
});

const formRef = ref();
const newFormInline = ref<FieldValues>(props.formInline);
const activeName = ref(0);
const formRefs = ref<Record<number, InstanceType<typeof PlusForm>>>({});

const emit = defineEmits<{
  /** PlusForm change 透传载荷 */
  change: [payload: { values: FieldValues; column: PlusColumn }];
}>();

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

/** `getRef` 返回的表单实例契约（见 `utils/types.ts` 的 `ExposedFormInstance`） */
type GetRefResult = ExposedFormInstance | undefined;

const setFormRef = (el: unknown, index: number) => {
  if (el) {
    formRefs.value[index] = el as InstanceType<typeof PlusForm>;
  }
};

const setActiveName = (index: number) => {
  activeName.value = index;
};

function getRef(): GetRefResult {
  if (isTabs.value) {
    const instance = formRefs.value[activeName.value]?.formInstance as
      GetRefResult | undefined;
    if (instance) {
      instance._allInstances = Object.keys(formRefs.value)
        .map(Number)
        .sort((a, b) => a - b)
        .map(key => formRefs.value[key]?.formInstance);
    }
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
        <PlusForm
          :ref="el => setFormRef(el, tabs.index)"
          v-model="newFormInline"
          :columns="tabs.columns"
          :hasFooter="false"
          :row-props="{ gutter: 24 }"
          label-position="right"
          label-width="120px"
          v-bind="formProps"
          @change="
            (values, column) => {
              emit('change', { values, column });
            }
          "
        />
      </el-tab-pane>
    </el-tabs>
    <PlusForm
      v-else
      ref="formRef"
      v-model="newFormInline"
      :columns="columns"
      :hasFooter="false"
      :row-props="{ gutter: 24 }"
      label-position="right"
      label-width="120px"
      v-bind="formProps"
      @change="
        (values, column) => {
          emit('change', { values, column });
        }
      "
    />
  </div>
</template>
