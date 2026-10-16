<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { FieldValues, PlusColumn, PlusForm } from "plus-pro-components";
import type { ExposedFormInstance } from "../utils/types";
import {
  measureRenderedLabelWidth,
  resolveAdaptiveLabelWidth
} from "../utils/adaptiveLabelWidth";

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
const formRootRef = ref<HTMLElement | null>(null);

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
  const _tabsColumns: Record<string | number, typeof props.columns> = {};
  const _tabsLabels: Record<string | number, string> = {};
  props.columns.forEach(column => {
    const index = column._column.tabs_index;
    _tabsLabels[index] = column._column.tabs_label;
    if (_tabsColumns[index]) {
      _tabsColumns[index].push(column);
    } else {
      _tabsColumns[index] = [column];
    }
  });
  const result: Array<{
    label: string;
    index: number;
    columns: typeof props.columns;
  }> = [];
  for (let i = 0; i < Object.keys(_tabsLabels).length; i++) {
    result.push({
      label: _tabsLabels[i],
      index: i,
      columns: _tabsColumns[i]
    });
  }
  return result;
});

/**
 * 表单标签宽度：按当前页签可见列（隐藏列不渲染标签）的最长标签自适应，长标签不折行。
 *
 * 两道计算：首帧用列元数据离屏估算，挂载后再按真实渲染的标签内容实测校正
 * （帮助图标尺寸、字体族差异等估算覆盖不到）；页签各自持有宽度，避免一个页签的
 * 长标签把另一个页签的控件列压窄。仍可被 `addOrEditOptions.props.labelWidth` 覆盖
 * （`v-bind="formProps"` 在后）。
 */
const groupColumns = (columns: PlusColumn[]) =>
  columns.filter(column => !column.hideInForm);

const estimateLayout = (columns: PlusColumn[]): FormLayoutState => ({
  labelWidth: resolveAdaptiveLabelWidth(groupColumns(columns)),
  fullWidth: false
});

// 弹窗表单的列间距（与模板 row-props 的 gutter 一致）
const FORM_GUTTER = 24;
// 控件列可用的最小宽度：低于此值时把半宽列升为整行
const MIN_CONTROL_WIDTH = 160;
// 以「md/lg/xl 断点为 12」声明的列 = 大屏半宽列（number / boolean / upload 等）
const HALF_WIDTH_BREAKPOINTS = ["md", "lg", "xl"] as const;

interface FormLayoutState {
  /** 该页签的统一标签宽度 */
  labelWidth: string;
  /** 半宽列是否升为整行（标签占宽后控件列不足时） */
  fullWidth: boolean;
}

const formLayouts = ref<Record<number, FormLayoutState>>({});

const isHalfWidthColumn = (column: PlusColumn) => {
  const colProps = column.colProps as Record<string, unknown> | undefined;
  if (!colProps) return false;
  return HALF_WIDTH_BREAKPOINTS.some(breakpoint => colProps[breakpoint] === 12);
};

/**
 * 半宽列升为整行：标签较宽时半宽列只剩几十像素（如售价的 el-input-number、
 * 上传区），控件不可用；升整行后控件列恢复为「弹窗内容宽 - 标签宽」。
 */
const expandHalfWidthColumns = (columns: PlusColumn[]) =>
  columns.map(column => {
    if (!isHalfWidthColumn(column)) return column;
    const colProps = { ...(column.colProps as Record<string, unknown>) };
    HALF_WIDTH_BREAKPOINTS.forEach(breakpoint => {
      colProps[breakpoint] = 24;
    });
    return { ...column, colProps } as PlusColumn;
  });

const tabGroups = () =>
  isTabs.value
    ? tabsColumns.value.map(tab => ({
        index: tab.index,
        columns: tab.columns as PlusColumn[]
      }))
    : [{ index: 0, columns: props.columns }];

const formHost = (index: number): HTMLElement | undefined =>
  (isTabs.value ? formRefs.value[index]?.$el : formRef.value?.$el) as
    HTMLElement | undefined;

const isSameLayouts = (
  a: Record<number, FormLayoutState>,
  b: Record<number, FormLayoutState>
) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].map(Number));
  for (const key of keys) {
    const next = a[key];
    const current = b[key];
    if (
      !next ||
      !current ||
      next.labelWidth !== current.labelWidth ||
      next.fullWidth !== current.fullWidth
    ) {
      return false;
    }
  }
  return true;
};

/** 重置为该表单的估算布局（列元数据变化时） */
const resetLayouts = () => {
  const next: Record<number, FormLayoutState> = {};
  tabGroups().forEach(group => {
    next[group.index] = estimateLayout(group.columns);
  });
  formLayouts.value = next;
};

/** 渲染后校正：实测标签宽度 + 判定半宽列是否需要升整行 */
const syncLayouts = async () => {
  await nextTick();
  const root = formRootRef.value;
  if (!root) return;
  const formWidth = root.clientWidth || root.getBoundingClientRect().width || 0;
  const halfColumnWidth = formWidth > 0 ? formWidth / 2 - FORM_GUTTER / 2 : 0;

  const next: Record<number, FormLayoutState> = { ...formLayouts.value };
  for (const group of tabGroups()) {
    const columns = groupColumns(group.columns);
    const current = next[group.index] ?? estimateLayout(group.columns);
    const host = formHost(group.index);
    const measured = host ? measureRenderedLabelWidth(host) : null;
    const labelWidth =
      measured &&
      Number.parseFloat(measured) > Number.parseFloat(current.labelWidth)
        ? measured
        : current.labelWidth;

    const fullWidth =
      columns.some(isHalfWidthColumn) &&
      halfColumnWidth > 0 &&
      halfColumnWidth - Number.parseFloat(labelWidth) < MIN_CONTROL_WIDTH;

    next[group.index] = { labelWidth, fullWidth };
  }

  if (!isSameLayouts(next, formLayouts.value)) formLayouts.value = next;
};

const layoutOf = (columns: PlusColumn[], index: number): FormLayoutState =>
  formLayouts.value[index] ?? estimateLayout(columns);

const tabsRenderData = computed(() =>
  tabsColumns.value.map(tab => {
    const layout = layoutOf(tab.columns as PlusColumn[], tab.index);
    return {
      ...tab,
      labelWidth: layout.labelWidth,
      formColumns: layout.fullWidth
        ? expandHalfWidthColumns(tab.columns)
        : tab.columns
    };
  })
);

const plainRenderData = computed(() => {
  const layout = layoutOf(props.columns, 0);
  return {
    labelWidth: layout.labelWidth,
    formColumns: layout.fullWidth
      ? expandHalfWidthColumns(props.columns)
      : props.columns
  };
});

onMounted(syncLayouts);
watch(
  () => props.columns,
  () => {
    resetLayouts();
    syncLayouts();
  }
);
// 页签切换后当前页签的标签才进入 DOM，随之校正布局
watch(activeName, () => {
  syncLayouts();
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
        .map(key => formRefs.value[key]?.formInstance as typeof instance);
    }
    return instance;
  }

  return formRef.value?.formInstance;
}

defineExpose({ getRef, setActiveName });
</script>

<template>
  <div ref="formRootRef">
    <el-tabs v-if="isTabs" v-model="activeName" v-bind="tabsProps">
      <el-tab-pane
        v-for="tabs in tabsRenderData"
        :key="tabs.index"
        :label="tabs.label"
        :name="tabs.index"
      >
        <PlusForm
          :ref="el => setFormRef(el, tabs.index)"
          v-model="newFormInline"
          :columns="tabs.formColumns"
          :hasFooter="false"
          :row-props="{ gutter: 24 }"
          label-position="right"
          :label-width="tabs.labelWidth"
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
      :columns="plainRenderData.formColumns"
      :hasFooter="false"
      :row-props="{ gutter: 24 }"
      label-position="right"
      :label-width="plainRenderData.labelWidth"
      v-bind="formProps"
      @change="
        (values, column) => {
          emit('change', { values, column });
        }
      "
    />
  </div>
</template>
