import type { RecordType } from "plus-pro-components";

/**
 * 操作列行兜底（纯函数，配 vitest）。
 *
 * 第三方表格的单元格 slot 传入的 row 是内部 cloneDeep 副本——对含复杂值
 * （组件实例/非可克隆对象）的行会退化为空对象；此时按行号从当前页数据取
 * 真实行，行级按钮（如按行显隐、取行字段）才可取到数据，无需退避到列
 * cellRenderer 绕行。
 *
 * - row 有内容：原样返回（副本也够展示用，保持既有行为）
 * - row 为空：按 index 从 dataList 取真实行
 * - 双双缺失：返回空对象（与旧行为一致，不抛错）
 */
export function resolveOperationRow(
  row: RecordType | undefined,
  index: unknown,
  dataList: RecordType[] | undefined
): RecordType {
  if (row && Object.keys(row).length) return row;
  const idx = Number(index);
  if (Number.isInteger(idx) && dataList?.[idx]) {
    return dataList[idx];
  }
  return row ?? {};
}
