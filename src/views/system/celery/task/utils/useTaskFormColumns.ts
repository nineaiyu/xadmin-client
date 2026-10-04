import { computed, onMounted, ref, type Ref } from "vue";
import type { PageColumn } from "@/components/RePlusPage";
import type { periodicTaskApi } from "@/api/system/task";
import { runnableTaskOptions, toRegisteredTaskOption } from "./taskOptions";

type TaskApiLike = Pick<typeof periodicTaskApi, "registered">;

/**
 * 定时任务新增/编辑表单列：任务路径为「可手动执行白名单任务下拉」。
 * 白名单外任务（后端 registered 附 runnable=false）不下发选项，且不再允许
 * 自由输入（allowCreate 已移除）——服务端创建与执行侧同样按白名单拦截（T02-04）。
 */
export function useTaskFormColumns({ api }: { api: TaskApiLike }) {
  /** 可手动执行任务下拉选项 */
  const registeredOptions = ref<{ name: string; verbose_name: string }[]>([]);
  const loadRegistered = async () => {
    const res = await api.registered();
    registeredOptions.value = runnableTaskOptions(res.data ?? []);
  };

  const baseColumnsFormat = ({
    addOrEditColumns
  }: {
    addOrEditColumns: Ref<PageColumn[]>;
  }) => {
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
        defaultFirstOption: true
      };
    }
  };

  onMounted(loadRegistered);

  return {
    baseColumnsFormat
  };
}
