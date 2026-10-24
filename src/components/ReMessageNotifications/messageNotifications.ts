/** 订阅行的渠道勾选态：原始订阅全保留，可见渠道按当前值覆盖 */
export function mergeBackendChecks(
  subscribed: string[] = [],
  visible: string[] = []
): Record<string, boolean> {
  const checks: Record<string, boolean> = {};
  subscribed.forEach(name => {
    checks[name] = true;
  });
  visible.forEach(name => {
    checks[name] = subscribed.includes(name);
  });
  return checks;
}
