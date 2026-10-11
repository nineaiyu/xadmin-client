import { get } from "lodash-es";
import { ref } from "vue";

/**
 * 选项值类型（对齐 Element Plus 选择器可承载的值域）。
 * 不含 `boolean`：`defineModel<T>()` 会据 TS 类型推断运行时 prop 类型，
 * 联合中一旦含 `Boolean`，Vue 会把「未传值」的 model 强制转成 `false`。
 */
export type ApiOptionValue = string | number | Record<string, unknown>;

/** 归一后的远程选项节点（label/value + 可选 disabled / children） */
export interface ApiOption {
  label: string;
  value: ApiOptionValue;
  disabled?: boolean;
  children?: ApiOption[];
  [key: string]: unknown;
}

/** 远程选项配置 */
export interface ApiOptionsConfig {
  /** 取数函数（返回数组或 `{ data }` / 由 resultField 指定路径） */
  api?: (params: Record<string, unknown>) => Promise<unknown>;
  /** 基础查询参数 */
  params?: Record<string, unknown>;
  /** 选项标签字段（支持 `a.b` 路径），默认 label */
  labelField?: string;
  /** 选项值字段，默认 value */
  valueField?: string;
  /** 子节点字段（留空时回退 item.children），用于树形 */
  childrenField?: string;
  /** 响应数据路径（如 data.items） */
  resultField?: string;
  /** 每次打开都重新取数 */
  alwaysLoad?: boolean;
  /** 值转字符串 */
  numberToString?: boolean;
  /** 取数前改写参数 */
  beforeFetch?: (
    params: Record<string, unknown>
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /** 取数后改写原始数据（作用于 resultField 提取后的数组） */
  afterFetch?: (data: unknown[]) => unknown[];
}

/**
 * 远程选项取数 + 归一化：供 `ReApiSelect` / `ReApiTreeSelect` 共用。
 * 首次取数后缓存（`alwaysLoad` 可关闭缓存），`updateParam` 合并参数并重取。
 */
export function useApiOptions(config: () => ApiOptionsConfig) {
  const options = ref<ApiOption[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const extraParams = ref<Record<string, unknown>>({});

  function transform(list: unknown[]): ApiOption[] {
    const c = config();
    return (list ?? []).map(raw => {
      const item = (raw ?? {}) as Record<string, unknown>;
      const childrenRaw = c.childrenField
        ? get(item, c.childrenField)
        : item?.children;
      const value = get(item, c.valueField || "value");
      const node: ApiOption = {
        ...item,
        label: get(item, c.labelField || "label") as string,
        value: (c.numberToString ? String(value) : value) as ApiOptionValue,
        disabled: get(item, "disabled") as boolean | undefined
      };
      if (Array.isArray(childrenRaw) && childrenRaw.length > 0) {
        node.children = transform(childrenRaw);
      }
      return node;
    });
  }

  async function fetch(force = false) {
    const c = config();
    if (!c.api) return;
    if (loaded.value && !force && !c.alwaysLoad) return;
    loading.value = true;
    try {
      let params = { ...(c.params ?? {}), ...extraParams.value };
      if (c.beforeFetch) {
        params = (await c.beforeFetch(params)) ?? params;
      }
      const res = await c.api(params);
      let data = (res as { data?: unknown })?.data ?? res;
      if (c.resultField) {
        data = get(data as object, c.resultField);
      }
      if (c.afterFetch) {
        data = c.afterFetch(data as unknown[]);
      }
      options.value = transform(Array.isArray(data) ? data : []);
      loaded.value = true;
    } catch {
      // 取数失败降级为空选项（消费方多为可选下拉，失败不应阻断表单与 unhandled rejection）；
      // 不置 loaded，下一次打开或 reload 可自动重试
      options.value = [];
    } finally {
      loading.value = false;
    }
  }

  /** 合并额外查询参数并强制重取 */
  function updateParam(params: Record<string, unknown>) {
    extraParams.value = { ...extraParams.value, ...params };
    return fetch(true);
  }

  return { options, loading, loaded, fetch, updateParam, transform };
}
