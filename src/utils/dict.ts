import { ref, type CSSProperties } from "vue";
import { dataDictApi, type DictItem } from "@/api/system/dict";
import { fetchAllRows } from "./fetchAllRows";
import { SOLID_TAG_STYLE } from "./tagTone";
import { createTtlCache } from "./ttlCache";

// 字典项类型再导出：页面只经本入口消费字典（值 + 类型），不直连 @/api/system/dict
export type { DictItem };

/**
 * 数据字典前端消费端（参考 RuoYi/Jeecg 的 getDicts 模式）。
 *
 * 后端 items 接口已带 5 分钟服务端缓存 + 变更信号失效，且在 PERMISSION_WHITE_URL
 * 白名单内（GET），登录用户可直接消费；本模块再做一层进程内 TTL 缓存（机制见
 * `ttlCache.ts`），避免同一页面多个下拉重复请求。表单/表格如需跟随字典维护即时
 * 变化，优先用 DictChoiceField（后端 choices 驱动，元数据自带），本 composable
 * 供自定义页面/非元数据场景直接消费。
 */

const DICT_TTL = 5 * 60 * 1000;

const dictCache = createTtlCache<DictItem[]>({ ttl: DICT_TTL });
const dictTypeCache = createTtlCache<DictTypeItem[]>({ ttl: DICT_TTL });
/** 字典类型清单缓存键（单一逻辑清单，键固定） */
const DICT_TYPES_KEY = "types";

/** 字典类型候选（绑定选择器用）：仅 code/label */
export type DictTypeItem = { code: string; label: string };

/**
 * 清空前端字典缓存（不传 code 清全部）。
 *
 * 字典维护页「刷新缓存」后调用，避免其他页面在其 TTL（5 分钟）内继续读旧字典。
 */
export function clearDictCache(code?: string) {
  dictCache.invalidate(code);
  if (!code) dictTypeCache.invalidate(DICT_TYPES_KEY);
}

/**
 * 字典类型候选（设计器「数据字典」绑定选择器）：启用中的类型行 code/label。
 *
 * 走字典管理列表接口（需要字典查看权限）；无权限时降级空数组，
 * 调用方回退为直接输入 code 的输入形态。失败不缓存（下次调用重试）。
 */
export function getDictTypes(): Promise<DictTypeItem[]> {
  return dictTypeCache
    .get(DICT_TYPES_KEY, async () => {
      const res = await fetchAllRows(dataDictApi.list, {
        is_type: true,
        is_active: true
      });
      const rows = (res?.data?.results ?? []) as {
        code: string;
        label: string;
      }[];
      return rows.map(item => ({
        code: item.code,
        label: item.label || item.code
      }));
    })
    .catch(() => [] as DictTypeItem[]);
}

/** 取字典项（带进程内 TTL 缓存与并发去重；失败返回空数组不缓存，下次调用重试） */
export function getDictItems(code: string): Promise<DictItem[]> {
  return dictCache
    .get(code, () =>
      dataDictApi.items(code).then(res => res?.data?.results ?? [])
    )
    .catch(() => {
      // 失败降级为空选项，避免消费端 unhandled rejection；不缓存以便重试
      return [] as DictItem[];
    });
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

/** 组件内用法：const { items, loading, refresh } = useDict("user_gender") */
export function useDict(code: string) {
  const items = ref<DictItem[]>([]);
  const loading = ref(false);
  const load = () => {
    loading.value = true;
    getDictItems(code)
      .then(data => {
        items.value = data;
      })
      .finally(() => {
        loading.value = false;
      });
  };
  load();
  return { items, loading, refresh: load };
}

/** ElTag 类型（状态列回退渲染用） */
export type StatusTagType =
  "primary" | "success" | "warning" | "info" | "danger";

/** 状态字段形态：DictChoiceField 序列化为 {value,label,color?}，兼容历史纯字符串 */
export type StatusValue =
  | { value?: string | number; label?: string; color?: string | null }
  | string
  | number
  | null
  | undefined;

/** 状态枚举的 tag 类型兜底映射（字典项未配置 color 时使用） */
export const STATUS_TAG_TYPE: Record<string, StatusTagType> = {
  PENDING: "info",
  RUNNING: "primary",
  SUCCESS: "success",
  FAILURE: "danger",
  REVOKED: "warning"
};

/**
 * 字典色 tag 的统一 props（数据字典页 / 列表 / 详情三处同款）。
 *
 * ElTag 的 color 只覆盖背景色，文字色与边框仍取默认 primary 语义色（蓝），
 * 不补 style 就会出现「红底蓝字蓝边」，与字典页配置的颜色观感不一致。
 */
export function dictTagProps(
  color?: string | null
): { color: string; style: CSSProperties } | undefined {
  if (!color) return undefined;
  return { color, style: SOLID_TAG_STYLE };
}

/**
 * 状态列 ElTag props 的规范取法：字典 color 优先（彩色 tag，与字典页/详情
 * 渲染器同款），无 color 回退 fallbackTypes 枚举映射（默认 STATUS_TAG_TYPE）。
 */
export function statusTagProps(
  status: StatusValue,
  fallbackTypes: Record<string, StatusTagType> = STATUS_TAG_TYPE
): { color?: string; type?: StatusTagType; style?: CSSProperties } {
  const item = typeof status === "object" && status !== null ? status : null;
  if (item?.color) {
    return { color: item.color, style: SOLID_TAG_STYLE };
  }
  const value = item ? item.value : status;
  return { type: fallbackTypes[String(value)] ?? "info" };
}

/**
 * labeled choice 序列化值的归一化取值。
 *
 * BaseModelSerializer 会把带 choices 的 CharField 自动换成 LabeledChoiceField，
 * 接口输出为 {value,label,...} 对象；表单控件（el-radio-group / el-select 等）
 * 只接受标量。自定义页面消费这类字段时统一经本函数取回原始枚举值，
 * 历史纯字符串输入原样透传（与 StatusValue 的兼容口径一致）。
 */
export function choiceValue(value: StatusValue): string {
  return typeof value === "object" && value !== null
    ? String(value.value ?? "")
    : String(value ?? "");
}
