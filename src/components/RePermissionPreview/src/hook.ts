// 权限只读预览通用加载逻辑（user / dept / role 三处预览组件共用）。
// 生命周期约定：组件由页面经 addDrawer 打开（destroyOnClose），挂载即按行主键
// 加载，data 置空避免上一个抽屉实例的残留数据闪现。
import { onMounted, ref } from "vue";

/** el-tree 只读展示配置（三处预览一致，收敛于此） */
export const PREVIEW_TREE_PROPS = { label: "title", children: "children" };

export function usePermissionPreview<T>(
  fetch: (pk: string) => Promise<T | undefined | null>,
  row: () => string | number | undefined
) {
  const loading = ref(false);
  const data = ref<T | null>(null);

  async function load(pk: string) {
    loading.value = true;
    try {
      data.value = (await fetch(pk)) ?? null;
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    data.value = null;
    // 挂载自动加载失败按空态呈现，不向全局抛未处理拒绝；显式 load() 仍原样上抛供调用方处理
    load(String(row())).catch(() => undefined);
  });

  return { loading, data, load };
}
