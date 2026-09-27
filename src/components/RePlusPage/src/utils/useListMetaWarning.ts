import { onUnmounted, ref, watch, type Ref } from "vue";

/**
 * 列表列元数据缺失检测（全环境生效）：列表请求已完成但列元数据仍为空——
 * 运行期表现为「页面空白但不报错」，是最高频的一类上手问题。
 * 判定点在「请求完成（loadingStatus true→false）」后留 1.5s 余量（列元数据可能走独立请求），
 * 元数据到达后自动清除。
 * - DEV：console.error 输出可操作的排查清单；
 * - PROD：metaMissing 交由模板渲染降级提示条，对最终用户可见，不再是无提示空白页。
 */
export function useListMetaWarning(
  searchMetaReady: Ref<boolean>,
  loadingStatus: Ref<boolean>
) {
  const metaMissing = ref(false);
  let metaWarnTimer: ReturnType<typeof setTimeout> | undefined;

  watch(searchMetaReady, ready => {
    if (!ready) return;
    metaMissing.value = false;
    clearTimeout(metaWarnTimer);
  });

  watch(
    () => loadingStatus.value,
    (loading, wasLoading) => {
      // 只在「请求刚完成」那一刻起算：new=false 且 old=true。
      // 写成 `!loading || !wasLoading` 会把这个分支正好 return 掉（定时器永不设置，
      // 警示条变死代码——2026-09-20 实测发现）。
      if (loading || !wasLoading) return;
      clearTimeout(metaWarnTimer);
      metaWarnTimer = setTimeout(() => {
        if (searchMetaReady.value || metaMissing.value) return;
        metaMissing.value = true;
        if (import.meta.env.DEV) {
          console.error(
            "[RePlusPage] 列表请求已完成，但未获取到列元数据（search-columns / search-fields），页面将无列可用。排查清单：\n" +
              "  1) app 是否已注册：config.yml 的 XADMIN_APPS（改后需重启进程）；\n" +
              "  2) 序列化器是否声明 Meta.fields / Meta.table_fields；\n" +
              "  3) 当前账号是否有该页面权限点（未授权时接口 403）。"
          );
        }
      }, 1500);
    }
  );

  // 组件卸载：停掉未决的判定定时器（否则回调会触碰已卸载组件的状态）
  onUnmounted(() => clearTimeout(metaWarnTimer));

  return { metaMissing };
}
