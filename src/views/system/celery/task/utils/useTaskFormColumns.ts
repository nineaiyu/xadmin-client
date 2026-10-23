import { computed, onMounted, ref, type Ref } from "vue";
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
export function useTaskFormColumns({ api }: { api: TaskApiLike }) {
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
        message(
          String(
            res.detail || transformI18n("systemTask.registeredLoadFailed")
          ),
          {
            type: "warning"
          }
        );
        return;
      }
      registeredOptions.value = runnableTaskOptions(res.data ?? []);
    } catch {
      registeredFailed.value = true;
      message(transformI18n("systemTask.registeredLoadFailed"), {
        type: "warning"
      });
    } finally {
      registeredLoading.value = false;
    }
  };

  const baseColumnsFormat = ({
    addOrEditColumns
  }: {
    addOrEditColumns: Ref<PageColumn[]>;
  }) => {
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
      taskCol.fieldProps = {
        filterable: true,
        defaultFirstOption: true,
        loading: registeredLoading.value,
        // 加载失败时下拉保留可重试入口，不产生未处理拒绝
        placeholder: registeredFailed.value
          ? transformI18n("systemTask.registeredLoadFailed")
          : undefined
      };
    }
  };

  onMounted(loadRegistered);

  return {
    baseColumnsFormat,
    loadRegistered
  };
}
