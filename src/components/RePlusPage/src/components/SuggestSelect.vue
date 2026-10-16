<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { getSuggestFetcher } from "../utils/suggest";

/**
 * 远程联想选择器。
 *
 * 由 `formFallbackRenderer` 在字段元数据携带 `suggest_url` 时接管原
 * `api-search-*` 弹窗渲染：候选集来自引用方 ViewSet 的 `/suggestions`
 * （与写入校验同一 queryset），输入关键词远程过滤。
 *
 * 存储口径与弹窗选择器一致：`{pk, label}` 对象（多选为数组），
 * 后端 `to_internal_value` 按 pk 取值；已选值缺 label 时自动按 `pks` 补拉回显。
 *
 * 关键词来源：el-select 的 remote-method 回调参数在自动化/受控回写环境下
 * 可能被污染（Playwright 实测曾传入 "xadminxadmin"），故以内部 input 的
 * DOM 真实值为准；两者对真实键入一致。
 */
interface SuggestItem {
  pk: string | number;
  label: string;
  [key: string]: unknown;
}

interface ValueItem {
  pk: string | number;
  label: string;
}

const props = withDefaults(
  defineProps<{
    /** suggestions 端点（search-columns 下发的 suggest_url） */
    url: string;
    /** 关联字段名（后端据此定位 serializer 关联字段白名单） */
    field: string;
    multiple?: boolean;
    /** 兼容运行时多形态载荷（表单值由上层透传），内部按 {pk,label} 收窄 */
    modelValue?: unknown;
  }>(),
  { multiple: false }
);

const model = defineModel<unknown>();

const emit = defineEmits<{
  change: [value: ValueItem | ValueItem[] | null];
}>();

const selectRef = ref();
const fetcher = getSuggestFetcher();
const options = ref<SuggestItem[]>([]);
const loading = ref(false);
let seq = 0;
let debounceTimer = 0;

/** 上层值收窄为 {pk,label} 列表（多选数组 / 单选单值） */
const asList = (value: unknown): ValueItem[] => {
  if (props.multiple) {
    return Array.isArray(value) ? (value.filter(Boolean) as ValueItem[]) : [];
  }
  const single = value as ValueItem | null | undefined;
  return single && typeof single === "object" && single.pk !== undefined
    ? [single]
    : [];
};

/** 当前已选 {pk,label} 列表（候选项的常驻保留面，供回显与选中态匹配） */
const selectedList = computed<ValueItem[]>(() => asList(model.value));

/**
 * 重建候选列表：**本次响应整体替换**搜索结果，仅保留当前已选项（回显需要）。
 *
 * 不能用「向现有 options 追加」的合并语义——remote 模式下拉渲染全部 options
 * 且不做本地过滤，追加会让上一次搜索的候选在空结果搜索中残留（实测：
 * 搜过 xadmin 后搜 hh，下拉仍显示 xadmin）。已选项 label 缺失时优先取
 * 响应行补齐（pks 补拉场景）。
 */
const mergeOptions = (rows: SuggestItem[]) => {
  const remote = new Map<string | number, SuggestItem>();
  for (const row of rows) {
    if (row && row.pk !== undefined && row.pk !== null) remote.set(row.pk, row);
  }
  const merged: SuggestItem[] = [];
  for (const selected of selectedList.value) {
    if (selected.pk === undefined || selected.pk === null) continue;
    const hit = remote.get(selected.pk);
    merged.push(
      hit
        ? { ...hit, label: selected.label || hit.label }
        : { ...selected, label: selected.label ?? String(selected.pk) }
    );
    remote.delete(selected.pk);
  }
  return [...merged, ...remote.values()];
};

const fetchOptions = async (extra: Record<string, unknown>) => {
  if (!fetcher) return;
  const current = ++seq;
  loading.value = true;
  try {
    const res = await fetcher(props.url, {
      field: props.field,
      limit: 20,
      ...extra
    });
    if (current !== seq) return;
    const rows = (Array.isArray(res?.data) ? res.data : []) as SuggestItem[];
    options.value = mergeOptions(rows);
  } catch {
    // HTTP 层已统一提示；此处只收敛本地状态（竞态响应直接丢弃）
    if (current === seq) options.value = mergeOptions([]);
  } finally {
    if (current === seq) loading.value = false;
  }
};

watch(
  model,
  value => {
    // 已选项必须常驻 options：EP 单选的 selectedLabel 从 options 按 pk 取
    // label，缺失时会退化为显示裸 pk（编辑回显曾显示 "1" 而非 "(xadmin)"）。
    // 仅在缺失时并入，不与 mergeOptions 的替换语义冲突。
    const known = new Set(options.value.map(option => option.pk));
    const missingSelected = selectedList.value.filter(
      item => item.pk !== undefined && item.pk !== null && !known.has(item.pk)
    );
    if (missingSelected.length) {
      options.value = [
        ...missingSelected.map(
          item =>
            ({ ...item, label: item.label ?? String(item.pk) }) as SuggestItem
        ),
        ...options.value
      ];
    }
    // 已选值缺 label（纯 pk 回显）时按 pks 补拉一次；label 齐全不发起请求
    const missing = asList(value).filter(
      item => item.pk !== undefined && !item.label
    );
    if (missing.length) {
      void fetchOptions({ pks: missing.map(item => item.pk).join(",") });
    }
  },
  { immediate: true, deep: true }
);

const remoteMethod = () => {
  const input = selectRef.value?.$el?.querySelector?.(
    ".el-select__input"
  ) as HTMLInputElement | null;
  const keyword = (input?.value ?? "").trim();
  if (!keyword) {
    // 展开下拉（EP 对空 query 也会回调 remote-method）：重置为仅已选项，
    // 清掉上一次搜索留下的无关候选
    options.value = mergeOptions([]);
    return;
  }
  // 300ms 防抖：EP remote select 输入即触发 remote-method，只放行最后一次
  if (debounceTimer) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(
    () => void fetchOptions({ search: keyword }),
    300
  );
};

/** el-select 绑定值始终是 pk（单选）/ pk 数组（多选）；拆两分支以命中 EP 泛型推断 */
const singleValue = computed<string | number>(
  () => asList(model.value)[0]?.pk ?? ""
);
const listValue = computed<Array<string | number>>(() =>
  asList(model.value).map(item => item.pk)
);

const handleSingle = (value: string | number) => {
  if (value === "" || value === null || value === undefined) {
    model.value = null;
    emit("change", null);
    return;
  }
  const hit = options.value.find(option => option.pk === value);
  const next: ValueItem = { pk: value, label: hit?.label ?? String(value) };
  model.value = next;
  emit("change", next);
};

const handleMulti = (value: Array<string | number>) => {
  const pks = Array.isArray(value) ? value : [];
  const previous = asList(model.value);
  const next: ValueItem[] = pks.map(pk => {
    const hit = options.value.find(option => option.pk === pk);
    const old = previous.find(item => item.pk === pk);
    return { pk, label: hit?.label ?? old?.label ?? String(pk) };
  });
  model.value = next;
  emit("change", next);
};
</script>

<template>
  <el-select
    v-if="multiple"
    ref="selectRef"
    :model-value="listValue"
    multiple
    filterable
    remote
    clearable
    :reserve-keyword="false"
    :loading="loading"
    :remote-method="remoteMethod"
    @update:model-value="handleMulti"
  >
    <el-option
      v-for="item in options"
      :key="item.pk"
      :label="item.label"
      :value="item.pk"
    />
  </el-select>
  <el-select
    v-else
    ref="selectRef"
    :model-value="singleValue"
    filterable
    remote
    clearable
    :reserve-keyword="false"
    :loading="loading"
    :remote-method="remoteMethod"
    @update:model-value="handleSingle"
  >
    <el-option
      v-for="item in options"
      :key="item.pk"
      :label="item.label"
      :value="item.pk"
    />
  </el-select>
</template>
