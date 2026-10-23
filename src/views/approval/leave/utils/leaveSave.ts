/**
 * 请假弹层的保存请求选择（纯函数，便于单测）：
 *
 * 新增 = create（保存后立即提交审批）；编辑 = partialUpdate(原 pk)。
 * 历史缺陷：编辑分支也走 create，改一次日期就多出一张重复请假单。
 */
export interface LeaveSaveApi<T> {
  create: (data: Record<string, unknown>) => T;
  partialUpdate: (pk: string | number, data: Record<string, unknown>) => T;
}

export function buildLeaveSaveRequest<T>(
  api: LeaveSaveApi<T>,
  formData: Record<string, unknown> | null | undefined,
  isAdd: boolean | undefined
): T {
  const pk = formData?.pk ?? formData?.id;
  // isAdd 缺省按新增处理（框架旧调用点不传该字段）
  if (isAdd !== false || pk == null) {
    return api.create(formData ?? {});
  }
  return api.partialUpdate(pk as string | number, formData ?? {});
}
