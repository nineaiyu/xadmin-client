import { computed, onMounted, ref, watch, type Ref } from "vue";
import type { PageColumn } from "@/components/RePlusPage";
import type { periodicTaskApi } from "@/api/task/task";
import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import { transformI18n } from "@/plugins/i18n";
import { runnableTaskOptions, toRegisteredTaskOption } from "./taskOptions";

type TaskApiLike = Pick<typeof periodicTaskApi, "registered">;

/**
 * 定时任务新增/编辑表单列：任务路径为「可手动执行白名单任务下拉」。
 * 白名单外任务（后端 registered 附 runnable=false）不下发选项，且不再允许
 * 自由输入（allowCreate 已移除）——服务端创建与执行侧同样按白名单拦截。
 */
export function useTaskFormColumns({
  api,
  canLoad
}: {
  api: TaskApiLike;
  /** 有新增/编辑权限才预取下拉；只读角色打开列表不应触发 403 请求 */
  canLoad?: () => boolean;
}) {
  /** 可手动执行任务下拉选项 */
  const registeredOptions = ref<{ name: string; verbose_name: string }[]>([]);
  const registeredLoading = ref(false);
  const registeredFailed = ref(false);

  const loadRegistered = async () => {
    if (registeredLoading.value) return;
    registeredLoading.value = true;
    registeredFailed.value = false;
    try {
      const res = await api.registered().catch(normalizeError);
      if (!isSuccess(res)) {
        registeredFailed.value = true;
        // HTTP/网络失败已由 http 层提示（normalizeError → code -1），不重复弹窗；
        // 仅 HTTP 200 + 业务码失败补一次可读提示
        if (res.code !== -1 && res.detail) {
          message(String(res.detail), { type: "warning" });
        }
        return;
      }
      registeredOptions.value = runnableTaskOptions(res.data ?? []);
    } catch {
      // 网络异常由 http 层统一提示，这里只留失败占位（下拉提示可重试）
      registeredFailed.value = true;
    } finally {
      registeredLoading.value = false;
    }
  };

  /** 当前打开表单的列集合（每次打开重新装配，loading/占位据此刷新） */
  let openColumns: Ref<PageColumn[]> | undefined;

  /** 下拉的实时 props：loading 与失败占位随请求状态更新，而不是打开时的快照 */
  const buildFieldProps = () => ({
    filterable: true,
    defaultFirstOption: true,
    loading: registeredLoading.value,
    // 加载失败时下拉保留可重试入口，不产生未处理拒绝
    placeholder: registeredFailed.value
      ? transformI18n("systemTask.registeredLoadFailed")
      : undefined
  });

  /** 列对象是响应式的：重新赋一个对象即可让 plus-pro 重新求值 fieldProps */
  const refreshTaskFieldProps = () => {
    const taskCol = openColumns?.value.find(
      (column: PageColumn) => column._column.key === "task"
    );
    if (taskCol) taskCol.fieldProps = buildFieldProps();
  };

  watch([registeredLoading, registeredFailed], refreshTaskFieldProps);

  const baseColumnsFormat = ({
    addOrEditColumns
  }: {
    addOrEditColumns: Ref<PageColumn[]>;
  }) => {
    openColumns = addOrEditColumns;
    // 打开表单时若上次加载失败/为空，重试一次，给下拉一个自愈入口
    if (!registeredOptions.value.length && !registeredLoading.value) {
      loadRegistered();
    }
    const taskCol = addOrEditColumns.value.find(
      (column: PageColumn) => column._column.key === "task"
    );
    if (taskCol) {
      taskCol.valueType = "select";
      taskCol.options = computed(() =>
        registeredOptions.value.map(option => toRegisteredTaskOption(option))
      );
      taskCol.fieldProps = buildFieldProps();
    }
  };

  onMounted(() => {
    if (canLoad?.() !== false) loadRegistered();
  });

  return {
    baseColumnsFormat,
    loadRegistered
  };
}
