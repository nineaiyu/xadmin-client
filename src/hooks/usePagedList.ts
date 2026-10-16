import { ref, shallowRef } from "vue";

import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import type { DataEnvelope } from "@/api/types";

/**
 * 远程分页列表原语（抽屉 / 弹窗内的只读列表；非表格页数据块）。
 *
 * 口径与 RePlusPage 的列表请求一致：统一信封判定（isSuccess）、异常归一
 * （normalizeError，网络错误与业务失败同分支）、**成功才替换行与总数**、
 * **请求序号守卫**（快速切页 / 连续触发时只接纳最新一次响应，防旧响应覆盖）。
 *
 * 响应 data 形态因接口契约而异（分页对象 / 裸数组 / 自定义键），故声明为
 * `unknown`，由调用点经 `pickRows`（必填）与 `pickTotal` 显式提取——
 * 类型转换点集中且显式，避免在泛型约束里做隐式结构兼容。
 */

/** 分页响应信封（= 公共 `DataEnvelope`；保留本名以贴合列表语境） */
export type PagedResponse = DataEnvelope;

export function usePagedList<TRow>(options: {
  /** 请求：分页参数（额外过滤参数由调用方闭包携带） */
  fetch: (params: { page: number; size: number }) => Promise<PagedResponse>;
  /** 行数组提取（必填：data 形态由接口契约决定） */
  pickRows: (res: PagedResponse) => TRow[];
  /** 总数提取（缺省取 data.total；缺失按 0） */
  pickTotal?: (res: PagedResponse) => number;
  /** 每页条数（默认 10） */
  pageSize?: number;
  /** 失败回调（业务失败与网络异常归一后统一回调；缺省静默） */
  onFail?: (res: PagedResponse) => void;
}) {
  const loading = ref(false);
  const page = ref(1);
  const size = ref(options.pageSize ?? 10);
  const total = ref(0);
  const rows = shallowRef<TRow[]>([]);

  let seq = 0;

  const pickTotal =
    options.pickTotal ??
    ((res: PagedResponse) =>
      (res.data as { total?: number } | null)?.total ?? 0);

  /** 加载（resetPage=true 时回第一页）；返回是否成功（失败保持现状，不自动提示） */
  async function load(resetPage = false): Promise<boolean> {
    if (resetPage) page.value = 1;
    const current = ++seq;
    loading.value = true;
    const res = await options
      .fetch({ page: page.value, size: size.value })
      .catch(normalizeError);
    if (current !== seq) return false;
    loading.value = false;
    if (!isSuccess(res)) {
      options.onFail?.(res as PagedResponse);
      return false;
    }
    const envelope = res as PagedResponse;
    rows.value = options.pickRows(envelope);
    total.value = pickTotal(envelope);
    return true;
  }

  /** 切页（直接绑定 el-pagination 的 current-change） */
  async function setPage(next: number) {
    page.value = Math.max(1, next);
    return load();
  }

  /** 改每页条数（绑定 size-change；回第一页） */
  async function setSize(next: number) {
    size.value = next;
    page.value = 1;
    return load();
  }

  return { loading, page, size, total, rows, load, setPage, setSize };
}
