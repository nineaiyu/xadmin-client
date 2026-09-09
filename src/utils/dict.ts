import { ref } from "vue";
import { dataDictApi, type DictItem } from "@/api/system/dict";

/**
 * 数据字典前端消费端（参考 RuoYi/Jeecg 的 getDicts 模式）。
 *
 * 后端 items 接口已带 5 分钟服务端缓存 + 变更信号失效；本模块再做一层
 * 进程内 TTL 缓存，避免同一页面多个下拉重复请求。表单/表格如需跟随字典
 * 维护即时变化，优先用 DictChoiceField（后端 choices 驱动，元数据自带），
 * 本 composable 供自定义页面/非元数据场景直接消费。
 */

const DICT_TTL = 5 * 60 * 1000;
const dictCache = new Map<string, { items: DictItem[]; expires: number }>();
const inflight = new Map<string, Promise<DictItem[]>>();

/** 取字典项（带进程内 TTL 缓存与并发去重） */
export function getDictItems(code: string): Promise<DictItem[]> {
  const cached = dictCache.get(code);
  if (cached && cached.expires > Date.now()) {
    return Promise.resolve(cached.items);
  }
  const pending = inflight.get(code);
  if (pending) return pending;

  const request = dataDictApi
    .items(code)
    .then(res => {
      const items = res?.data?.results ?? [];
      dictCache.set(code, { items, expires: Date.now() + DICT_TTL });
      return items;
    })
    .finally(() => {
      inflight.delete(code);
    });
  inflight.set(code, request);
  return request;
}

/** 按 value 反查字典项（找不到返回 undefined） */
export function getDictItem(
  code: string,
  value: string | number | null | undefined
): Promise<DictItem | undefined> {
  return getDictItems(code).then(items =>
    items.find(item => item.value === String(value ?? ""))
  );
}

/** 组件内用法：const { items } = useDict("user_gender") */
export function useDict(code: string) {
  const items = ref<DictItem[]>([]);
  getDictItems(code).then(data => {
    items.value = data;
  });
  return { items };
}
