/** 提交数据展示（纯函数）：非标量值 JSON 化，避免附件/日期范围/明细行渲染成 [object Object] */
export const submissionDataText = (data: Record<string, unknown>) =>
  Object.entries(data ?? {})
    .map(([key, value]) => {
      const text =
        typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : ((value ?? "-") as string);
      return `${key}: ${text}`;
    })
    .join(" | ") || "-";
