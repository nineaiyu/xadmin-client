import { onUnmounted, ref } from "vue";

/**
 * 搜索区展开/收起的过渡。PlusSearch 的展开就是「增删搜索列」，两处都会让卡片高度瞬跳：
 * 展开时新列当帧插入、但高度要下一帧才落位（首帧仅 1px，异步渲染的字段更晚）；
 * 收起时离场列被库内过渡滞留约 200ms 才移除，高度先在原地不动再整块塌掉。
 * 这里统一处理为「冻结起始高度 → 轮询到真实高度落定 → 在两者之间补一段高度过渡」，
 * 过渡期用 clip-path 裁掉溢出内容（不能用 overflow: hidden：它会改变卡片自身的高度
 * 计算，量出的目标高度偏小），展开时新增行像从卡片下缘被揭开，收起时反向收拢。
 * 表格自适应用 ResizeObserver 逐帧跟随，无需在此同步。
 */
export function useSearchCardCollapse() {
  const searchCardRef = ref<HTMLElement>();
  let animation: Animation | undefined;
  let pollRaf = 0;

  const onSearchCollapse = (expanded: boolean) => {
    const card = searchCardRef.value;
    if (!card) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // 连点：起始高度取在途动画的当前帧值，再停掉它
    const from = card.getBoundingClientRect().height;
    animation?.cancel();
    animation = undefined;
    cancelAnimationFrame(pollRaf);
    card.style.height = `${from}px`;
    card.style.clipPath = "inset(0)";

    const release = () => {
      card.style.height = "";
      card.style.clipPath = "";
      animation?.cancel();
      animation = undefined;
    };
    /** 量真实高度：同帧内解除冻结再恢复，不产生中间绘制 */
    const naturalHeight = () => {
      card.style.height = "";
      const height = card.getBoundingClientRect().height;
      card.style.height = `${from}px`;
      return height;
    };
    /** 收起时离场列仍留在布局里占位，量目标高度时先把它们排除（展开时无离场列） */
    const excludeLeavingColumns = () => {
      const leaving = expanded
        ? []
        : Array.from(
            card.querySelectorAll<HTMLElement>(".plus-form__row > .el-col")
          ).filter(el => el.style.opacity === "0");
      leaving.forEach(el => (el.style.display = "none"));
      return () => leaving.forEach(el => (el.style.display = ""));
    };

    let last = -1;
    let stable = 0;
    const startedAt = performance.now();
    const step = () => {
      if (!card.isConnected) return;
      const restoreColumns = excludeLeavingColumns();
      const target = naturalHeight();
      restoreColumns();
      // 连续两帧不变才动手，避开列内容未落位的中间高度
      stable = Math.abs(target - last) < 0.5 ? stable + 1 : 0;
      last = target;
      if (stable < 2 && performance.now() - startedAt < 400) {
        pollRaf = requestAnimationFrame(step);
        return;
      }
      if (Math.abs(target - from) < 1) {
        release();
        return;
      }
      animation = card.animate(
        [{ height: `${from}px` }, { height: `${target}px` }],
        {
          duration: 260,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          // 终态由动画持有：结束事件若晚一帧到达，也不会先回落到起始高度
          fill: "forwards"
        }
      );
      animation.onfinish = release;
    };
    pollRaf = requestAnimationFrame(step);
  };

  // 组件卸载：停掉在途动画与高度轮询（否则动画 onfinish 会触碰已卸载节点）
  onUnmounted(() => {
    cancelAnimationFrame(pollRaf);
    animation?.cancel();
    animation = undefined;
  });

  return { searchCardRef, onSearchCollapse };
}
