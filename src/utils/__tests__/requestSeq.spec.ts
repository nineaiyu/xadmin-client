import { describe, expect, it } from "vitest";
import {
  createKeyedRequestSeqGuard,
  createRequestSeqGuard
} from "../requestSeq";

/** 请求序号守卫：网络乱序下仅最新一次请求的响应可写结果（命令面板全局搜索消费） */
describe("createRequestSeqGuard", () => {
  it("首发请求的序号在无后续请求时恒为最新", () => {
    const seq = createRequestSeqGuard();
    const ticket = seq.start();
    expect(seq.isLatest(ticket)).toBe(true);
  });

  it("新请求发起后，旧序号立即过期（旧响应后到不得覆盖新结果）", () => {
    const seq = createRequestSeqGuard();
    const stale = seq.start();
    const fresh = seq.start();
    expect(seq.isLatest(stale)).toBe(false);
    expect(seq.isLatest(fresh)).toBe(true);
  });

  it("序号单调递增；过期判定只认最新一次", () => {
    const seq = createRequestSeqGuard();
    const tickets = [seq.start(), seq.start(), seq.start()];
    expect(tickets).toEqual([1, 2, 3]);
    // 只有最后一次仍是最新，前两次全部作废
    expect(tickets.map(t => seq.isLatest(t))).toEqual([false, false, true]);
  });

  it("清空输入等「无请求」路径也可 bump 序号使在途请求作废", () => {
    const seq = createRequestSeqGuard();
    const inFlight = seq.start();
    // 用户清空关键词：不发出新请求，但必须让在途响应过期（否则旧词结果回填）
    const invalidated = seq.start();
    expect(seq.isLatest(inFlight)).toBe(false);
    expect(seq.isLatest(invalidated)).toBe(true);
  });

  it("各守卫实例互不影响（组件卸载重建后从 1 重新计数）", () => {
    const a = createRequestSeqGuard();
    const b = createRequestSeqGuard();
    a.start();
    a.start();
    const bTicket = b.start();
    expect(b.isLatest(bTicket)).toBe(true);
  });
});

/** 按键隔离的请求序号守卫：多字段选人候选缓存等「同页多槽位并发搜索」消费
 * （SubmissionForm / useFormDataFilters）——不同键互不失效，同键内仅最新可写 */
describe("createKeyedRequestSeqGuard", () => {
  it("同键内新请求使旧序号过期", () => {
    const guard = createKeyedRequestSeqGuard<string>();
    const stale = guard.start("field-a");
    const fresh = guard.start("field-a");
    expect(guard.isLatest("field-a", stale)).toBe(false);
    expect(guard.isLatest("field-a", fresh)).toBe(true);
  });

  it("不同键互不失效（A 字段的新请求不作废 B 字段的在途响应）", () => {
    const guard = createKeyedRequestSeqGuard<string>();
    const aTicket = guard.start("field-a");
    guard.start("field-b");
    expect(guard.isLatest("field-a", aTicket)).toBe(true);
    const bTicket = guard.start("field-b");
    expect(guard.isLatest("field-b", bTicket)).toBe(true);
  });

  it("各键序号独立计数", () => {
    const guard = createKeyedRequestSeqGuard<string>();
    expect(guard.start("a")).toBe(1);
    expect(guard.start("a")).toBe(2);
    expect(guard.start("b")).toBe(1);
  });
});
