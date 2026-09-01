// Attention Portfolio 0.1 - 回归测试（基线 Case A-V + 单元与边界）
// 用法：node tests.mjs
// 引擎直接从 index.html 的 ENGINE 标记区提取，保证测试对象与线上代码同源。

import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const m = html.match(/\/\/ ===== ENGINE START =====([\s\S]*?)\/\/ ===== ENGINE END =====/);
if (!m) { console.error("FATAL: index.html 中未找到 ENGINE 标记"); process.exit(1); }

const E = new Function(m[1] + "\nreturn { CONSEQUENCE_LEVELS, deadlineInfo, deadlinePressure, taskUrgency, computeProject, computePortfolio, weekIdOf, clampPlanned, applyWeekRollover, dateStrOf, addDaysStr, weekStartStr, shiftMonthStr, todoBuckets, groupByDeadline, wallInfo };")();
const { deadlinePressure, taskUrgency, computePortfolio, computeProject, weekIdOf, clampPlanned, applyWeekRollover, dateStrOf, addDaysStr, weekStartStr, shiftMonthStr, todoBuckets, groupByDeadline, wallInfo } = E;

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + (detail !== undefined ? "  -> " + JSON.stringify(detail) : "")); }
}

let seq = 0;
const T = (o = {}) => ({ id: "t" + (++seq), projectId: "p1", name: "task" + seq, remainingEffort: 4, plannedThisWeek: 2, deadline: null, consequence: 0, completed: false, ...o });
const P = (o = {}) => ({ id: "p1", name: "P", description: "", archived: false, ...o });
const dl = n => { const d = new Date(); d.setDate(d.getDate() + n); const p = x => String(x).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
const pf = (projects, tasks, cap = 24) => computePortfolio(projects, tasks, cap);

console.log("\n[Units] Deadline Pressure 分档");
check("无 DDL -> 0", deadlinePressure(T({ deadline: null })) === 0);
check("> 14 天 -> 0.10", deadlinePressure(T({ deadline: dl(20) })) === 0.10);
check("8-14 天 -> 0.25", deadlinePressure(T({ deadline: dl(10) })) === 0.25);
check("4-7 天 -> 0.50", deadlinePressure(T({ deadline: dl(5) })) === 0.50);
check("2-3 天 -> 0.75", deadlinePressure(T({ deadline: dl(3) })) === 0.75 && deadlinePressure(T({ deadline: dl(2) })) === 0.75);
check("<= 1 天 -> 1.00", deadlinePressure(T({ deadline: dl(1) })) === 1 && deadlinePressure(T({ deadline: dl(0) })) === 1);
check("已逾期 -> 1.00", deadlinePressure(T({ deadline: dl(-3) })) === 1);
check("Ut = (Dt + Ct) / 2", Math.abs(taskUrgency(T({ deadline: dl(1), consequence: 0.33 })) - (1 + 0.33) / 2) < 1e-12);

console.log("\n[Units] Wt / 周 / rollover");
check("clampPlanned(2,8) = 2", clampPlanned(2, 8) === 2);
check("clampPlanned(3,5) = 3", clampPlanned(3, 5) === 3);
check("clampPlanned(5,2) = 2", clampPlanned(5, 2) === 2);
check("weekIdOf 取周一", weekIdOf(new Date(2026, 8, 2)) === "2026-08-31");
{
  const rol = applyWeekRollover({ version: 1, settings: { capacity: 20 }, weekId: "2020-01-06", projects: [], tasks: [T({ plannedThisWeek: 4 }), T({ plannedThisWeek: 0 })] }, "2026-08-31");
  check("rollover 触发", rol.changed === true);
  check("rollover Wt 清零", rol.state.tasks[0].plannedThisWeek === 0);
  check("rollover 任务保留", rol.state.tasks.length === 2);
  check("同周不触发", applyWeekRollover({ weekId: "2026-08-31", tasks: [] }, "2026-08-31").changed === false);
}

console.log("\n[Case A] 高总工时 + 单一主项目");
{
  const r = pf([P(), P({ id: "p2" })], [
    T({ projectId: "p1", remainingEffort: 20, plannedThisWeek: 14 }),
    T({ projectId: "p2", remainingEffort: 4, plannedThisWeek: 2 }),
  ], 20);
  check("FOCUSED 或 LOADED", ["FOCUSED", "LOADED"].includes(r.status), r.status);
  check("不应 BURNING OUT", r.status !== "BURNING OUT");
  check("单一项目集中 Pmax >= 0.65", r.Pmax >= 0.65, r.Pmax);
}

console.log("\n[Case B] 相同总工时 + 多项目平均分散");
{
  const r = pf([P(), P({ id: "p2" }), P({ id: "p3" }), P({ id: "p4" })],
    [1, 2, 3, 4].map(i => T({ projectId: "p" + i, remainingEffort: 6, plannedThisWeek: 4 })), 20);
  const rA = pf([P(), P({ id: "p2" })], [
    T({ projectId: "p1", remainingEffort: 20, plannedThisWeek: 14 }),
    T({ projectId: "p2", remainingEffort: 4, plannedThisWeek: 2 }),
  ], 20);
  check("LOADED", r.status === "LOADED", r.status);
  check("F 明显高于 A", r.F > rA.F, { F: r.F, FA: rA.F });
  check("F = 1.0（均匀分布）", Math.abs(r.F - 1) < 1e-9, r.F);
}

console.log("\n[Case C] 低总工时 + 多个临近硬 DDL");
{
  const r = pf([P()], [
    T({ remainingEffort: 1, plannedThisWeek: 1, deadline: dl(1), consequence: 1 }),
    T({ remainingEffort: 1, plannedThisWeek: 1, deadline: dl(2), consequence: 1 }),
    T({ remainingEffort: 1, plannedThisWeek: 1, deadline: dl(0), consequence: 1 }),
  ], 20);
  check("LOADED（不能 CLEAR）", r.status === "LOADED", r.status);
  check("D72 = 3", r.D72 === 3, r.D72);
  check("Primary = Deadline Concentration", r.pressure.key === "Deadline Concentration", r.pressure.key);
}

console.log("\n[Case D] 高工时 + 多个 BURNING");
{
  const r = pf([P(), P({ id: "p2" }), P({ id: "p3" })],
    [1, 2, 3].map(i => T({ projectId: "p" + i, remainingEffort: 10, plannedThisWeek: 8, deadline: dl(1), consequence: 1 })), 24);
  check("BURNING OUT", r.status === "BURNING OUT", r.status);
  check("B = 3", r.B === 3);
  check("Primary = Concurrent Urgency", r.pressure.key === "Concurrent Urgency");
}

console.log("\n[Case E] 多个极短任务 + 高 F + 低总负荷");
{
  const r = pf([P(), P({ id: "p2" }), P({ id: "p3" }), P({ id: "p4" })],
    [1, 2, 3, 4].map(i => T({ projectId: "p" + i, remainingEffort: 1, plannedThisWeek: 1 })), 24);
  check("CLEAR", r.status === "CLEAR", r.status);
  check("不因 F 高报警", r.F === 1 && r.pressure.key === null, { F: r.F, p: r.pressure.key });
}

console.log("\n[Case F] 一个很短今天必须完成 + 大量低压工作");
{
  const r = pf([P()], [
    T({ remainingEffort: 0.5, plannedThisWeek: 0.5, deadline: dl(0), consequence: 1 }),
    ...Array.from({ length: 4 }, () => T({ remainingEffort: 6, plannedThisWeek: 2, consequence: 0.33 })),
  ], 24);
  check("Project ACTIVE/HEAVY", ["ACTIVE", "HEAVY"].includes(r.projects[0].state), r.projects[0].state);
  check("1 个 Immediate Task", r.projects[0].immediateIds.length === 1);
}

console.log("\n[Case G] Remaining 40h / DDL 三周后 / Wt = 0");
{
  const r = pf([P()], [T({ remainingEffort: 40, plannedThisWeek: 0, deadline: dl(21), consequence: 0 })], 24);
  check("项目 DORMANT", r.projects[0].state === "DORMANT");
  check("不占 Weekly Capacity", r.Lp === 0);
  check("无 Unplanned 标记", r.projects[0].unplannedIds.length === 0);
}

console.log("\n[Case H] Remaining 30h / 本周 Wt 8h / Capacity 20h");
{
  const r = pf([P()], [T({ remainingEffort: 30, plannedThisWeek: 8 })], 20);
  check("Lp = 0.4", Math.abs(r.Lp - 0.4) < 1e-9, r.Lp);
}

console.log("\n[Case I] 两项目 60/40 占本周绝大多数，无 DDL 冲突");
{
  const r = pf([P(), P({ id: "p2" })], [
    T({ projectId: "p1", remainingEffort: 15, plannedThisWeek: 10.2 }),
    T({ projectId: "p2", remainingEffort: 10, plannedThisWeek: 6.8 }),
  ], 20);
  check("FOCUSED", r.status === "FOCUSED", r.status);
}

console.log("\n[Case J] 四项目 25/25/25/25 高负荷");
{
  const r = pf([P(), P({ id: "p2" }), P({ id: "p3" }), P({ id: "p4" })],
    [1, 2, 3, 4].map(i => T({ projectId: "p" + i, remainingEffort: 6, plannedThisWeek: 4.25 })), 20);
  check("LOADED", r.status === "LOADED", r.status);
  check("识别高 Fragmentation", r.pressure.key === "Fragmentation", r.pressure.key);
}

console.log("\n[Case K] 一个 0.5h 今天硬 DDL 任务");
{
  const r = pf([P()], [T({ remainingEffort: 0.5, plannedThisWeek: 0.5, deadline: dl(0), consequence: 1 })], 24);
  check("HEAVY 而非 BURNING", r.projects[0].state === "HEAVY", r.projects[0].state);
  check("出现 Immediate Task", r.projects[0].immediateIds.length === 1);
}

console.log("\n[Case L] 昨日已逾期且有实际后果");
{
  const r = pf([P()], [T({ remainingEffort: 2, plannedThisWeek: 2, deadline: dl(-1), consequence: 0.67 })], 24);
  check("Doverdue = 1", r.Doverdue === 1, r.Doverdue);
  check("不从 DDL 风险中消失（LOADED）", r.status === "LOADED", r.status);
  check("逾期不计入 D72", r.D72 === 0);
}

console.log("\n[Case M] 两个 BURNING 但总负荷 50%");
{
  const r = pf([P(), P({ id: "p2" })],
    [1, 2].map(i => T({ projectId: "p" + i, remainingEffort: 8, plannedThisWeek: 6, deadline: dl(1), consequence: 1 })), 24);
  check("B = 2", r.B === 2);
  check("默认 LOADED 而非 BURNING OUT", r.status === "LOADED", r.status);
  check("Primary = Concurrent Urgency", r.pressure.key === "Concurrent Urgency");
}

console.log("\n[Case N] 三个 BURNING");
{
  const r = pf([P(), P({ id: "p2" }), P({ id: "p3" })],
    [1, 2, 3].map(i => T({ projectId: "p" + i, remainingEffort: 8, plannedThisWeek: 6, deadline: dl(1), consequence: 1 })), 24);
  check("触发 BURNING OUT", r.status === "BURNING OUT", r.status);
}

console.log("\n[Case O] Lp 0.75 / Ptop2 0.90 / D72 = 2");
{
  const r = pf([P(), P({ id: "p2" }), P({ id: "p3" })], [
    T({ projectId: "p1", remainingEffort: 14, plannedThisWeek: 10 }),
    T({ projectId: "p2", remainingEffort: 6, plannedThisWeek: 3.5 }),
    T({ projectId: "p3", remainingEffort: 3, plannedThisWeek: 1.5, deadline: dl(1), consequence: 0.67 }),
    T({ projectId: "p1", remainingEffort: 3, plannedThisWeek: 0, deadline: dl(2), consequence: 0.33 }),
  ], 20);
  check("LOADED 而非 FOCUSED", r.status === "LOADED", r.status);
  check("D72 = 2", r.D72 === 2, r.D72);
}

console.log("\n[Case P] Lp 1.20 单一项目 B = 1");
{
  const r = pf([P()], [T({ remainingEffort: 30, plannedThisWeek: 24, consequence: 1 })], 20);
  check("LOADED 而非 FOCUSED", r.status === "LOADED", r.status);
  check("B = 1", r.B === 1);
}

console.log("\n[Case Q] Wt = 0 明天硬 DDL");
{
  const r = pf([P()], [T({ remainingEffort: 3, plannedThisWeek: 0, deadline: dl(1), consequence: 1 })], 24);
  check("项目保持 DORMANT", r.projects[0].state === "DORMANT");
  check("Portfolio 暴露 D72 = 1", r.D72 === 1, r.D72);
  check("出现 Unplanned Deadline 标记", r.projects[0].unplannedIds.length === 1);
}

console.log("\n[Case R] Ht = 2h 输入 Wt = 8h");
check("阻止或自动修正：Wt <= Ht", clampPlanned(2, 8) === 2);

console.log("\n[Case S] 新周开始，Ht = 6h 上周 Wt = 4h");
{
  const st = { version: 1, settings: { capacity: 24 }, weekId: "2020-01-06", projects: [P()], tasks: [T({ remainingEffort: 6, plannedThisWeek: 4 })] };
  const r = applyWeekRollover(st, "2026-08-31");
  check("任务保留", r.state.tasks.length === 1);
  check("新周 Wt = 0", r.state.tasks[0].plannedThisWeek === 0);
  check("Ht 保留", r.state.tasks[0].remainingEffort === 6);
}

console.log("\n[Case T] Ht 8h -> 3h 而 Wt = 5h");
check("Wt 自动 clamp 到 3h", clampPlanned(3, 5) === 3);

console.log("\n[Case U] Lp 0.85 / 60-40 两项目 / 无 DDL 冲突");
{
  const r = pf([P(), P({ id: "p2" })], [
    T({ projectId: "p1", remainingEffort: 15, plannedThisWeek: 10.2 }),
    T({ projectId: "p2", remainingEffort: 10, plannedThisWeek: 6.8 }),
  ], 20);
  check("FOCUSED", r.status === "FOCUSED", r.status);
  check("不因 entropy 高误判", r.F > 0.9 && r.status === "FOCUSED", r.F);
}

console.log("\n[Case V] Lp 0.85 四项目近似均分");
{
  const r = pf([P(), P({ id: "p2" }), P({ id: "p3" }), P({ id: "p4" })],
    [1, 2, 3, 4].map(i => T({ projectId: "p" + i, remainingEffort: 6, plannedThisWeek: 4.25 })), 20);
  check("LOADED", r.status === "LOADED", r.status);
  check("Primary 可为 Fragmentation", r.pressure.key === "Fragmentation", r.pressure.key);
}

console.log("\n[Extra] 决策树与边界");
{
  const empty = pf([], [], 24);
  check("空数据 -> CLEAR", empty.status === "CLEAR");
  check("空数据 -> No significant pressure", empty.pressure.key === null);
  const overFrag = pf([P(), P({ id: "p2" }), P({ id: "p3" })],
    [1, 2, 3].map(i => T({ projectId: "p" + i, remainingEffort: 9, plannedThisWeek: 8 })), 20);
  check("Lp>1 且 Ptop2<0.70 -> BURNING OUT", overFrag.status === "BURNING OUT", overFrag.status);
  const tie = pf([P(), P({ id: "p2" })],
    [1, 2].map(i => T({ projectId: "p" + i, remainingEffort: 9, plannedThisWeek: 9, deadline: dl(1), consequence: 1 })), 20);
  check("B=2 且 Lp>=0.8 -> BURNING OUT", tie.status === "BURNING OUT", tie.status);
  check("tie-break 优先 Concurrent Urgency", tie.pressure.key === "Concurrent Urgency", tie.pressure.key);
  const zero = pf([P()], [T({ remainingEffort: 5, plannedThisWeek: 5 })], 24);
  check("全零压力 -> 无 Primary", pf([P()], [T({ remainingEffort: 2, plannedThisWeek: 1 })], 24).pressure.key === null);
  check("归档项目不参与计算", pf([P({ archived: true })], [T({ remainingEffort: 5, plannedThisWeek: 5 })], 24).Lp === 0);
  check("已完成任务不计入", pf([P()], [T({ remainingEffort: 5, plannedThisWeek: 5, completed: true })], 24).Lp === 0);
  const pDormant = computeProject(P(), [T({ plannedThisWeek: 0 })], 24);
  check("computeProject DORMANT", pDormant.state === "DORMANT" && pDormant.weightedU === null);
}

console.log("\n[Units] To-do 视图 · 日期工具");
check("dateStrOf 本地时区", dateStrOf(new Date(2026, 8, 1)) === "2026-09-01");
check("addDaysStr 跨月", addDaysStr("2026-08-31", 1) === "2026-09-01");
check("addDaysStr 负数跨月", addDaysStr("2026-09-01", -1) === "2026-08-31");
check("addDaysStr 跨年", addDaysStr("2026-01-01", -1) === "2025-12-31");
check("addDaysStr 闰年", addDaysStr("2028-02-28", 1) === "2028-02-29");
check("weekStartStr 周二取周一", weekStartStr("2026-09-01") === "2026-08-31");
check("weekStartStr 周日归本周", weekStartStr("2026-09-06") === "2026-08-31");
check("weekStartStr 周一不动", weekStartStr("2026-08-31") === "2026-08-31");
check("weekStartStr 与 weekIdOf 同口径", weekStartStr(dateStrOf(new Date(2026, 8, 2))) === weekIdOf(new Date(2026, 8, 2)));
check("shiftMonthStr 进位", shiftMonthStr("2026-08-14", 1) === "2026-09-01");
check("shiftMonthStr 跨年", shiftMonthStr("2026-01-15", -1) === "2025-12-01");
check("shiftMonthStr 12 月", shiftMonthStr("2026-12-15", 1) === "2027-01-01");

console.log("\n[Units] To-do 视图 · 分桶与分组");
const NOW = new Date(2026, 8, 1, 12, 0, 0); // 2026-09-01 周二正午：固定基准，避免用例随时段漂移
{
  const b = todoBuckets([
    T({ deadline: "2026-08-30" }), T({ deadline: "2026-09-01" }),
    T({ deadline: "2026-09-02" }), T({ deadline: "2026-09-03" }),
    T({ deadline: "2026-09-04" }), T({ deadline: "2026-09-10" }),
    T({ deadline: "2026-09-01", completed: true }), T({ deadline: null }),
  ], NOW);
  check("逾期 1", b.overdue.length === 1);
  check("今天 1（排除已完成）", b.today.length === 1);
  check("72h 内 2（+1/+2 天）", b.soon.length === 2);
  check("更远 2", b.future.length === 2);
  check("四桶互斥覆盖全部未完成有 DDL 任务", b.overdue.length + b.today.length + b.soon.length + b.future.length === 6);
}
{
  const g = groupByDeadline([
    T({ deadline: "2026-09-01" }), T({ deadline: "2026-09-03" }), T({ deadline: "2026-09-03" }),
    T({ deadline: "2026-08-30" }), T({ deadline: null }), T({ deadline: "2026-09-03", completed: true }),
  ], "2026-09-01", "2026-09-06");
  check("闭区间含首日", (g["2026-09-01"] || []).length === 1);
  check("同日聚合", (g["2026-09-03"] || []).length === 2);
  check("排除区间外日期", g["2026-08-30"] === undefined);
  check("排除无 DDL 与已完成", Object.keys(g).length === 2);
}

console.log("\n[Units] To-do 视图 · DDL 墙判定（单周≥3 / 单日≥2 / 72h 内）");
{
  const w = wallInfo([T({ deadline: "2026-09-14" }), T({ deadline: "2026-09-15" }), T({ deadline: "2026-09-16" })], NOW);
  check("单周 3 个 -> 墙", w.weeks["2026-09-14"].wall === true);
  check("原因含单周口径", w.weeks["2026-09-14"].reasons[0] === "单周 3 个 DDL");
  check("dayMax = 1", w.weeks["2026-09-14"].dayMax === 1);
}
{
  const w = wallInfo([T({ deadline: "2026-09-14" }), T({ deadline: "2026-09-14" })], NOW);
  check("单日 2 个 -> 墙", w.weeks["2026-09-14"].wall === true);
  check("原因含单日口径", w.weeks["2026-09-14"].reasons[0] === "单日最多 2 个");
  check("dayMax = 2", w.weeks["2026-09-14"].dayMax === 2);
}
{
  const w = wallInfo([T({ deadline: "2026-09-02" })], NOW);
  check("72h 内单个 DDL -> 墙", w.weeks["2026-08-31"].wall === true);
  check("day.hot 标记", w.days["2026-09-02"].hot === true);
}
{
  const w = wallInfo([T({ deadline: "2026-09-16" })], NOW);
  check("远处单个 DDL -> 非墙", w.weeks["2026-09-14"].wall === false);
  check("非墙无原因文案", w.weeks["2026-09-14"].reasons.length === 0);
}
{
  const w = wallInfo([T({ deadline: "2026-08-30" })], NOW);
  check("单个逾期不触发墙（72h 口径不含逾期）", w.weeks["2026-08-24"].wall === false);
  check("逾期日标记 overdue", w.days["2026-08-30"].overdue === true);
}
{
  const w = wallInfo([T({ deadline: "2026-09-02" }), T({ deadline: "2026-09-15" }), T({ deadline: "2026-09-17" })], NOW);
  check("本周因 72h 成墙", w.weeks["2026-08-31"].wall === true);
  check("下周 2 个分散 DDL 不成墙", w.weeks["2026-09-14"].wall === false);
}
{
  const w = wallInfo([T({ deadline: "2026-09-01", completed: true }), T({ deadline: null })], NOW);
  check("已完成/无 DDL 不参与墙判定", Object.keys(w.weeks).length === 0 && Object.keys(w.days).length === 0);
}

console.log("\n===== " + pass + " passed, " + fail + " failed =====");
process.exit(fail ? 1 : 0);
