import { reactive, ref, type Ref, type UnwrapNestedRefs } from "vue";
import { useI18n } from "vue-i18n";
import { usePageAuth, type Auths } from "@/router/utils";
import type { OperationProps } from "../components/ButtonOperation";
import type { PageTableColumn, RePlusPageProps } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];
/** 仅需读取当前 locale 值（避免与具体语言联合类型绑死） */
type TLocale = { readonly value: string };
type AddOrEditOptions =
  | RePlusPageProps["addOrEditOptions"]
  | Ref<RePlusPageProps["addOrEditOptions"]>;
type MaybeRefOperationProps = OperationProps | Ref<OperationProps>;

/** 列表页装配上下文：工厂标准接线后的共享引用（回调内直接使用） */
interface DefineListPageContext<TApi extends object, K extends string> {
  api: UnwrapNestedRefs<TApi>;
  auth: Auths & Record<K, boolean>;
  tableRef: Ref;
  localeName: string;
  t: TFunction;
  locale: TLocale;
}

/** 列回调上下文：在基础上下文上附带本次待格式化的列 */
interface DefineListPageColumnsContext<
  TApi extends object,
  K extends string
> extends DefineListPageContext<TApi, K> {
  columns: PageTableColumn[];
}

interface DefineListPageButtons {
  tableBarButtonsProps?: MaybeRefOperationProps;
  operationButtonsProps?: MaybeRefOperationProps;
}

interface DefineListPageOptions<TApi extends object, K extends string = never> {
  /** 页面 API 实例（工厂内 reactive 包装，页面 `api.xxx` 读取口径不变） */
  api: TApi;
  /** 列表本地化命名空间（与模板 `locale-name` 同值） */
  localeName: string;
  /** 页面专用权限位（默认按钮位由 usePageAuth 统一扫描） */
  extraAuth?: K[];
  /** 显式权限码后缀（默认按当前组件名推导；历史命名如 `*:Tag` 时使用） */
  authSuffix?: string;
  /** 列格式化：返回 undefined 时保留入参列（与既有 hook 契约一致） */
  columns?: (
    ctx: DefineListPageColumnsContext<TApi, K>
  ) => PageTableColumn[] | void;
  /** 工具栏 / 行内按钮组，返回哪个就透传哪个 */
  buttons?: (ctx: DefineListPageContext<TApi, K>) => DefineListPageButtons;
  /** 新增 / 编辑弹层配置 */
  formOptions?: (ctx: DefineListPageContext<TApi, K>) => AddOrEditOptions;
}

interface DefineListPageResult<TApi extends object, K extends string = never> {
  api: UnwrapNestedRefs<TApi>;
  auth: Auths & Record<K, boolean>;
  tableRef: Ref;
  t: TFunction;
  addOrEditOptions?: AddOrEditOptions;
  listColumnsFormat?: (columns: PageTableColumn[]) => PageTableColumn[];
  tableBarButtonsProps?: MaybeRefOperationProps;
  operationButtonsProps?: MaybeRefOperationProps;
}

/**
 * 列表页装配工厂：收敛 `useI18n + reactive(api) + usePageAuth + 列/按钮/表单
 * 接线 + return` 的重复样板。
 *
 * 必须在页面 `setup` 内同步调用：`usePageAuth` 依据当前组件实例推导权限后缀
 * （`getCurrentInstance().type.name`），因此本工厂不接受组件名参数；权限码与
 * 菜单授权口径保持页面 `defineOptions({ name })` 不变。
 *
 * 页面专属副作用（轮询、watch、自定义 ref）与额外返回值仍留在各页 hook，
 * 工厂只负责标准接线；`tableRef` 由工厂创建并返回，页面用它绑定 `RePlusPage`。
 */
export function defineListPage<TApi extends object, K extends string = never>(
  options: DefineListPageOptions<TApi, K>
): DefineListPageResult<TApi, K> {
  const { api: rawApi, localeName, extraAuth = [], authSuffix } = options;
  const api = reactive(rawApi) as UnwrapNestedRefs<TApi>;
  const auth = authSuffix
    ? usePageAuth(authSuffix, extraAuth)
    : usePageAuth(extraAuth);
  const tableRef = ref();
  const { t, locale } = useI18n();

  const ctx = { api, auth, tableRef, localeName, t, locale };
  const formatColumns = options.columns;
  const listColumnsFormat = formatColumns
    ? (columns: PageTableColumn[]) =>
        formatColumns({ ...ctx, columns }) ?? columns
    : undefined;

  // 与既有页面 hook 一致：先表单、后按钮（按钮可能读取 guard 改写后的 auth）
  const addOrEditOptions = options.formOptions?.(ctx);
  const buttons = options.buttons?.(ctx);

  return {
    api,
    auth,
    tableRef,
    t,
    ...(addOrEditOptions === undefined ? {} : { addOrEditOptions }),
    ...(listColumnsFormat ? { listColumnsFormat } : {}),
    ...(buttons?.tableBarButtonsProps === undefined
      ? {}
      : { tableBarButtonsProps: buttons.tableBarButtonsProps }),
    ...(buttons?.operationButtonsProps === undefined
      ? {}
      : { operationButtonsProps: buttons.operationButtonsProps })
  };
}

export type {
  AddOrEditOptions,
  DefineListPageButtons,
  DefineListPageColumnsContext,
  DefineListPageContext,
  DefineListPageOptions,
  DefineListPageResult,
  MaybeRefOperationProps
};
