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
 * 这里给出可读解释，避免误判为数据丢失（白名单是部署前提，见 docs/architecture/field-permission.md）。
 */
const isBlankDetail = computed(() => {
  const values = Object.values(newFormInline.value ?? {});
  return (
    values.length > 0 && values.every(value => value === null || value === "")
  );
});

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

    instance._allInstances = Object.keys(formRefs.value)
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
