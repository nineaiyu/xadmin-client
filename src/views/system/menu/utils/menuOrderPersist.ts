/** 排序提交依赖（与 useMenuOrder 的入参解耦，便于单测替换） */
export interface MenuOrderPersistDeps {
  patchRows: (patch: Map<string, Record<string, unknown>>) => void;
  submitRank: (pks: Array<number | string>) => Promise<boolean>;
  reload: () => void;
}

/** 前序 pk 顺序 + rank 写回（rank 取前序序号，与后端 rank 接口口径一致） */
export async function persistMenuOrder(
  pks: Array<string | number>,
  { patchRows, submitRank, reload }: MenuOrderPersistDeps
) {
  const patch = new Map<string, Record<string, unknown>>();
  pks.forEach((pk, index) => patch.set(String(pk), { rank: index + 1 }));
  patchRows(patch);
  const ok = await submitRank(pks);
  if (!ok) reload();
  return ok;
}
