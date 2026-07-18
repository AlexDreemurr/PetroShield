import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Columns3,
  Copy,
  Map as MapIcon,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import AlarmCenterMap from "../components/AlarmCenterMap/AlarmCenterMap";
import { API_BASE_URL } from "../config/api";

const LEVEL_TONES = { 重大: "critical", 严重: "danger", 中等: "warning", 一般: "normal" };
const PRIORITY_LABELS = { low: "低", medium: "中", high: "高", urgent: "紧急" };
const ASSIGNMENT_STATUS_LABELS = { assigned: "待接单", accepted: "处理中", completed: "已完成", cancelled: "已取消" };
const ACTION_LABELS = {
  create: "系统生成告警",
  confirm: "确认告警",
  mark_false_positive: "标记误报",
  dispatch: "派发处理",
  submit_feedback: "提交现场反馈",
  review_approve: "复核通过并关闭",
  review_reject: "驳回重办",
  close: "关闭事件",
};
const PAGE_SIZE = 10;
const ALL_COLUMNS = [
  { key: "time", label: "发生时间" },
  { key: "type", label: "告警类型" },
  { key: "level", label: "风险等级" },
  { key: "subject", label: "人员/设备" },
  { key: "status", label: "状态" },
];

function toDateInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDateTime(value, includeSeconds = true) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", ...(includeSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  }).format(new Date(value)).replaceAll("/", "-");
}

function defaultDueTime() {
  const value = new Date(Date.now() + 30 * 60 * 1000);
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function buildQuery(filters, page) {
  const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
  return params.toString();
}

function StatusBadge({ status }) {
  return <Status $status={status}>{status === "新建" ? "待处理" : status}</Status>;
}

function LevelBadge({ level }) {
  return <Level $tone={LEVEL_TONES[level] ?? "normal"}>{level}</Level>;
}

function ProcessTimeline({ detail }) {
  const stages = [
    { key: "新建", label: "新建", action: "create", hint: "系统自动生成" },
    { key: "确认", label: "已确认", action: "confirm", hint: "待处理" },
    { key: "处理中", label: "处理中", action: "dispatch", hint: "待处理" },
    { key: "待复核", label: "待复核", action: "submit_feedback", hint: "待处理" },
    { key: "关闭", label: "已关闭", action: "review_approve", alternateAction: "close", hint: "待处理" },
  ];
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.key === detail?.status));
  return (
    <ProcessPanel>
      <ProcessTitle>处理流程</ProcessTitle>
      <ProcessSteps>
        {stages.map((stage, index) => {
          const log = detail?.logs?.find((item) => item.action === stage.action || item.action === stage.alternateAction);
          const reached = index <= currentIndex && detail?.status !== "误报";
          return (
            <ProcessStep key={stage.key} $reached={reached}>
              <StepDot>{reached ? <Check size={13} /> : index + 1}</StepDot>
              <StepCopy>
                <strong>{stage.label}</strong>
                <span>{log ? formatDateTime(log.create_time, false) : stage.hint}</span>
              </StepCopy>
              {index < stages.length - 1 && <StepLine $reached={index < currentIndex} />}
            </ProcessStep>
          );
        })}
      </ProcessSteps>
    </ProcessPanel>
  );
}

function ActionDialog({ action, operators, busy, onClose, onSubmit }) {
  const actionConfig = {
    confirm: {
      title: "确认告警",
      label: "确认说明",
      placeholder: "请说明核实依据",
      defaultComment: "已核对关联人员、设备、位置及现场证据，确认该告警有效。",
      notice: "确认后系统将生成辅助处置建议，告警进入待派发状态。",
    },
    mark_false_positive: {
      title: "标记为误报",
      label: "误报原因",
      placeholder: "请填写判断为误报的依据",
      defaultComment: "",
      notice: "误报是终态操作，原因将写入审计记录。",
    },
    dispatch: { title: "派发处理任务", notice: "派单后告警进入处理中，处理人员可提交现场反馈。" },
    submit_feedback: {
      title: "提交现场反馈",
      label: "处置结果",
      placeholder: "请说明现场核实情况、采取的措施和当前风险状态",
      defaultComment: "",
      notice: "提交后告警进入待复核状态。",
    },
    review_approve: {
      title: "复核通过并关闭",
      label: "复核意见",
      placeholder: "请填写复核结论",
      defaultComment: "已核验现场反馈与处置结果，风险已解除，同意关闭事件。",
      notice: "通过后事件正式闭环，操作记录仍可追溯。",
    },
    review_reject: {
      title: "驳回现场反馈",
      label: "驳回原因",
      placeholder: "请说明需要补充或重新处理的内容",
      defaultComment: "",
      notice: "驳回后告警重新进入处理中。",
    },
    close: {
      title: "关闭告警事件",
      label: "关闭原因",
      placeholder: "请填写直接关闭事件的依据",
      defaultComment: "",
      notice: "直接关闭会同步取消尚未完成的派单。",
    },
  }[action];
  const [form, setForm] = useState({
    assignee_id: operators[0]?.id ?? "",
    department: operators[0]?.department ?? "",
    priority: "high",
    instruction: "到场核实告警，控制现场风险并反馈处置结果",
    due_time: defaultDueTime(),
    comment: actionConfig?.defaultComment ?? "",
    evidence_note: "",
  });
  const selectedOperator = operators.find((item) => item.id === form.assignee_id);
  const requiresComment = action !== "dispatch";
  const submit = () => {
    const payload = { ...form };
    if (action === "dispatch") payload.department = selectedOperator?.department ?? form.department;
    if (action === "submit_feedback" && form.evidence_note.trim()) {
      payload.evidence = [{ type: "note", content: form.evidence_note.trim() }];
    }
    delete payload.evidence_note;
    onSubmit(payload);
  };
  return (
    <ModalBackdrop role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <Dialog role="dialog" aria-modal="true" aria-label={actionConfig.title}>
        <DialogHeader><strong>{actionConfig.title}</strong><IconButton onClick={onClose} aria-label="关闭"><X size={17} /></IconButton></DialogHeader>
        <DialogBody>
          <ActionNotice>{actionConfig.notice}</ActionNotice>
          {action === "dispatch" ? <>
            <Field><label>处理人员</label>{operators.length ? <select value={form.assignee_id} onChange={(event) => setForm({ ...form, assignee_id: event.target.value })}>
              {operators.map((item) => <option key={item.id} value={item.id}>{item.name} / {item.department} / {item.position}</option>)}</select> : <FieldError>暂无可派发的在线人员，请先检查人员状态。</FieldError>}</Field>
            <FieldRow>
              <Field><label>优先级</label><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></Field>
              <Field><label>要求完成时间</label><input type="datetime-local" value={form.due_time} onChange={(event) => setForm({ ...form, due_time: event.target.value })} /></Field>
            </FieldRow>
            <Field><label>处置要求</label><textarea value={form.instruction} onChange={(event) => setForm({ ...form, instruction: event.target.value })} /></Field>
          </> : <>
            <Field><label>{actionConfig.label}</label><textarea autoFocus value={form.comment} placeholder={actionConfig.placeholder} onChange={(event) => setForm({ ...form, comment: event.target.value })} /></Field>
            {action === "submit_feedback" && <Field><label>证据补充说明（选填）</label><input value={form.evidence_note} placeholder="例如：现场照片已由班组留档" onChange={(event) => setForm({ ...form, evidence_note: event.target.value })} /></Field>}
          </>}
        </DialogBody>
        <DialogFooter><SecondaryButton disabled={busy} onClick={onClose}>取消</SecondaryButton><PrimaryButton disabled={busy || (requiresComment && !form.comment.trim()) || (action === "dispatch" && (!form.assignee_id || !form.instruction.trim() || !form.due_time))} onClick={submit}>{busy ? "提交中..." : "确认提交"}</PrimaryButton></DialogFooter>
      </Dialog>
    </ModalBackdrop>
  );
}

function AlarmCenter() {
  const today = useMemo(() => new Date(), []);
  const weekAgo = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6), [today]);
  const emptyFilters = useMemo(() => ({ start_date: toDateInput(weekAgo), end_date: toDateInput(today), alarm_type: "", level: "", status: "", keyword: "" }), [today, weekAgo]);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [listData, setListData] = useState({ items: [], total: 0, options: { types: [], levels: [], statuses: [] } });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [operators, setOperators] = useState([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [mapType, setMapType] = useState("map");
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS.map((item) => item.key));
  const [dialogAction, setDialogAction] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [toast, setToast] = useState("");

  const loadList = useCallback(async (signal) => {
    setIsListLoading(true);
    setListError("");
    try {
      const response = await fetch(`${API_BASE_URL}/alarms?${buildQuery(filters, page)}`, { signal });
      if (!response.ok) throw new Error("告警数据加载失败");
      const payload = await response.json();
      setListData(payload);
      setSelectedId((current) => payload.items.some((item) => item.id === current) ? current : payload.items[0]?.id ?? null);
    } catch (error) {
      if (error.name !== "AbortError") { setListData((current) => ({ ...current, items: [], total: 0 })); setListError(error.message); }
    } finally { if (!signal.aborted) setIsListLoading(false); }
  }, [filters, page]);

  useEffect(() => { const controller = new AbortController(); loadList(controller.signal); return () => controller.abort(); }, [loadList, refreshToken]);
  useEffect(() => { fetch(`${API_BASE_URL}/alarms/operators`).then((res) => res.ok ? res.json() : Promise.reject()).then((data) => setOperators(data.items ?? [])).catch(() => setOperators([])); }, []);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    const controller = new AbortController();
    setIsDetailLoading(true); setDetailError(""); setDetail(null);
    fetch(`${API_BASE_URL}/alarms/${selectedId}`, { signal: controller.signal })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("告警详情加载失败")))
      .then(setDetail).catch((error) => { if (error.name !== "AbortError") setDetailError(error.message); })
      .finally(() => !controller.signal.aborted && setIsDetailLoading(false));
    return () => controller.abort();
  }, [selectedId, refreshToken]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 2200); return () => clearTimeout(timer); }, [toast]);

  const updateFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const performAction = async (action, values = {}) => {
    if (!selectedId) return;
    setIsActionLoading(true);
    try {
      const body = { action, operator_name: "张三", operator_role: "运营管理员", ...values };
      if (body.due_time) body.due_time = new Date(body.due_time).toISOString();
      else delete body.due_time;
      const response = await fetch(`${API_BASE_URL}/alarms/${selectedId}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.detail || "操作失败"); }
      const payload = await response.json();
      setDetail(payload);
      setListData((current) => ({
        ...current,
        items: current.items.map((item) => item.id === payload.id ? { ...item, status: payload.status } : item),
      }));
      setDialogAction(null);
      setToast(`${ACTION_LABELS[action] ?? "告警操作"}成功`);
    } catch (error) { setToast(error.message); } finally { setIsActionLoading(false); }
  };
  const pageCount = Math.max(1, Math.ceil(listData.total / PAGE_SIZE));

  const renderActions = () => {
    if (!detail) return null;
    if (detail.status === "新建") return <><SecondaryButton disabled={isActionLoading} onClick={() => setDialogAction("mark_false_positive")}><XCircle size={15} />标记误报</SecondaryButton><PrimaryButton disabled={isActionLoading} onClick={() => setDialogAction("confirm")}><CheckCircle2 size={15} />确认告警</PrimaryButton></>;
    if (detail.status === "确认") return <><SecondaryButton disabled={isActionLoading} onClick={() => setDialogAction("close")}>关闭事件</SecondaryButton><PrimaryButton disabled={isActionLoading} onClick={() => setDialogAction("dispatch")}><Send size={15} />派发处理</PrimaryButton></>;
    if (detail.status === "处理中") return <PrimaryButton disabled={isActionLoading} onClick={() => setDialogAction("submit_feedback")}><ClipboardCheck size={15} />提交反馈</PrimaryButton>;
    if (detail.status === "待复核") return <><SecondaryButton disabled={isActionLoading} onClick={() => setDialogAction("review_reject")}>驳回重办</SecondaryButton><PrimaryButton disabled={isActionLoading} onClick={() => setDialogAction("review_approve")}><CheckCircle2 size={15} />复核通过</PrimaryButton></>;
    return <TerminalState><CheckCircle2 size={16} />该事件已{detail.status}</TerminalState>;
  };

  return (
    <Page>
      <PageHeader>
        <PageTitle>告警中心</PageTitle>
        <HeaderActions>
          <MenuWrap><ToolButton onClick={() => setColumnMenuOpen((value) => !value)}><Columns3 size={16} />列设置</ToolButton>{columnMenuOpen && <ColumnMenu>{ALL_COLUMNS.map((column) => <label key={column.key}><input type="checkbox" checked={visibleColumns.includes(column.key)} onChange={() => setVisibleColumns((current) => current.includes(column.key) ? current.filter((key) => key !== column.key) : [...current, column.key])} />{column.label}</label>)}</ColumnMenu>}</MenuWrap>
          <IconButton title="刷新" aria-label="刷新" onClick={() => setRefreshToken((value) => value + 1)}><RefreshCw size={17} /></IconButton>
        </HeaderActions>
      </PageHeader>

      <Filters>
        <DateRange><input type="date" value={filters.start_date} onChange={(event) => updateFilter("start_date", event.target.value)} /><span>至</span><input type="date" value={filters.end_date} onChange={(event) => updateFilter("end_date", event.target.value)} /></DateRange>
        <FilterField><span>告警类型</span><select value={filters.alarm_type} onChange={(event) => updateFilter("alarm_type", event.target.value)}><option value="">全部</option>{listData.options.types.map((item) => <option key={item}>{item}</option>)}</select></FilterField>
        <FilterField><span>风险等级</span><select value={filters.level} onChange={(event) => updateFilter("level", event.target.value)}><option value="">全部</option>{listData.options.levels.map((item) => <option key={item}>{item}</option>)}</select></FilterField>
        <FilterField><span>状态</span><select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">全部</option>{listData.options.statuses.map((item) => <option key={item}>{item}</option>)}</select></FilterField>
        <SearchBox><input value={filters.keyword} placeholder="请输入关键词" onChange={(event) => updateFilter("keyword", event.target.value)} /><Search size={16} /></SearchBox>
        <ToolButton onClick={() => { setFilters(emptyFilters); setPage(1); }}><RotateCcw size={15} />重置</ToolButton>
      </Filters>

      <Workspace>
        <ListPanel>
          <ListSummary>共 <strong>{listData.total}</strong> 条</ListSummary>
          <AlarmTable $visible={visibleColumns.join(" ")}>
            <TableHeader>{ALL_COLUMNS.filter((item) => visibleColumns.includes(item.key)).map((item) => <span key={item.key}>{item.label}</span>)}</TableHeader>
            <TableBody>
              {isListLoading ? <Centered>告警数据加载中</Centered> : listError ? <Centered $error>{listError}</Centered> : listData.items.length === 0 ? <Centered>暂无符合条件的告警</Centered> : listData.items.map((item) => <TableRow key={item.id} $selected={item.id === selectedId} onClick={() => setSelectedId(item.id)}>
                {visibleColumns.includes("time") && <span>{formatDateTime(item.time)}</span>}
                {visibleColumns.includes("type") && <strong title={item.type}>{item.type}</strong>}
                {visibleColumns.includes("level") && <span><LevelBadge level={item.level} /></span>}
                {visibleColumns.includes("subject") && <span title={item.subject?.name}>{item.subject?.name ?? item.area?.name ?? "--"}</span>}
                {visibleColumns.includes("status") && <span><StatusBadge status={item.status} /></span>}
              </TableRow>)}
            </TableBody>
          </AlarmTable>
          <Pagination><IconButton disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={15} /></IconButton><span>第 {page} / {pageCount} 页</span><IconButton disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight size={15} /></IconButton></Pagination>
        </ListPanel>

        <MapPanel>
          <MapTabs><button className={mapType === "map" ? "active" : ""} onClick={() => setMapType("map")}><MapIcon size={14} />地图</button><button className={mapType === "satellite" ? "active" : ""} onClick={() => setMapType("satellite")}>卫星</button></MapTabs>
          <AlarmCenterMap detail={detail} isDataLoading={isDetailLoading} hasDataError={Boolean(detailError)} mapType={mapType} />
          <MapLegend><span><i className="area" />风险区域</span><span><i className="critical" />重大</span><span><i className="danger" />严重</span><span><i className="normal" />一般</span><span><Camera size={14} color="#1677ff" />摄像头</span></MapLegend>
        </MapPanel>

        <DetailPanel>
          {isDetailLoading ? <Centered>告警详情加载中</Centered> : detailError ? <Centered $error>{detailError}</Centered> : detail ? <>
            <DetailHeader $tone={LEVEL_TONES[detail.level] ?? "normal"}><div><Bell size={18} /><strong>{detail.type}</strong><LevelBadge level={detail.level} /></div><span>告警ID：{detail.id}<IconButton title="复制告警ID" onClick={() => navigator.clipboard?.writeText(detail.id)}><Copy size={13} /></IconButton></span></DetailHeader>
            <DetailScroll>
              <InfoRows>
                <InfoRow><span>告警类型</span><strong>{detail.type}</strong></InfoRow>
                <InfoRow><span>风险等级</span><LevelBadge level={detail.level} /></InfoRow>
                <InfoRow><span>人员/设备</span><strong>{detail.subject?.name ?? "未关联"}</strong></InfoRow>
                <InfoRow><span>发生时间</span><strong>{formatDateTime(detail.time)}</strong></InfoRow>
                <InfoRow><span>所在区域</span><strong>{detail.area?.name ?? "未标注区域"}</strong></InfoRow>
                <InfoRow><span>AI置信度</span><strong>{detail.confidence == null ? "--" : `${(detail.confidence * 100).toFixed(1)}%`}</strong></InfoRow>
                <InfoRow><span>当前状态</span><StatusBadge status={detail.status} /></InfoRow>
              </InfoRows>
              <DetailSection><h3>告警描述</h3><p>{detail.description || "暂无描述"}</p></DetailSection>
              <DetailSection><h3>处理建议</h3><Advice>{detail.ai_advice?.edited_content || detail.ai_advice?.content || "确认告警后生成辅助处置建议。"}</Advice></DetailSection>
              {detail.assignment && <DetailSection><h3>当前派单</h3><Assignment><UserRound size={16} /><div><strong>{detail.assignment.assignee_name || "待接单"}</strong><span>{detail.assignment.department} · {PRIORITY_LABELS[detail.assignment.priority]}优先级 · {ASSIGNMENT_STATUS_LABELS[detail.assignment.status] ?? detail.assignment.status}</span><span>要求完成：{formatDateTime(detail.assignment.due_time, false)}</span></div></Assignment><p>{detail.assignment.instruction}</p>{detail.assignment.feedback && <Feedback>现场反馈：{detail.assignment.feedback}</Feedback>}</DetailSection>}
              <DetailSection><h3>关联资源</h3><ResourceTags>{detail.resources?.length ? detail.resources.slice(0, 5).map((item) => <span key={item.id}>{item.type?.includes("摄像") ? <Camera size={13} /> : <CircleDot size={13} />}{item.name}</span>) : <em>暂无关联资源</em>}</ResourceTags></DetailSection>
              <DetailSection><h3>视频预览</h3><VideoPreview><Camera size={30} /><button aria-label="播放关联视频"><Play size={20} fill="currentColor" /></button><span>{detail.resources?.find((item) => item.type?.includes("摄像"))?.name ?? "暂无可用视频流"}</span></VideoPreview></DetailSection>
              <DetailSection><h3>操作记录</h3><AuditList>{detail.logs?.length ? [...detail.logs].reverse().slice(0, 6).map((item) => <li key={item.id}><i /><div><strong>{ACTION_LABELS[item.action] ?? item.action}</strong><span>{item.operator_name} · {formatDateTime(item.create_time, false)}</span>{item.comment && <p>{item.comment}</p>}</div></li>) : <li><div><span>暂无操作记录</span></div></li>}</AuditList></DetailSection>
            </DetailScroll>
            <DetailActions>{renderActions()}</DetailActions>
          </> : <Centered>请选择一条告警</Centered>}
        </DetailPanel>

        <ProcessTimeline detail={detail} />
      </Workspace>
      {dialogAction && <ActionDialog action={dialogAction} operators={operators} busy={isActionLoading} onClose={() => setDialogAction(null)} onSubmit={(values) => performAction(dialogAction, values)} />}
      {toast && <Toast>{toast}</Toast>}
    </Page>
  );
}

const border = "1px solid #e3e8ef";
const Page = styled.div`height: 100%; min-height: 0; overflow: hidden; padding: 12px 14px 14px; color: #172033; background: #f8fafc; display: grid; grid-template-rows: 34px 44px minmax(0, 1fr); gap: 8px; font-size: 12px;`;
const PageHeader = styled.div`display: flex; align-items: center; justify-content: space-between;`;
const PageTitle = styled.h1`font-size: 18px; line-height: 1; letter-spacing: 0;`;
const HeaderActions = styled.div`display: flex; gap: 8px; align-items: center;`;
const MenuWrap = styled.div`position: relative;`;
const ToolButton = styled.button`height: 32px; padding: 0 12px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: ${border}; border-radius: 5px; color: #445067; background: #fff; cursor: pointer; font-size: 12px; &:hover { color: #1677ff; border-color: #8bb9fa; }`;
const IconButton = styled.button`width: 32px; height: 32px; display: inline-grid; place-items: center; flex: 0 0 auto; border: ${border}; border-radius: 5px; color: #536078; background: #fff; cursor: pointer; &:hover:not(:disabled) { color: #1677ff; } &:disabled { opacity: .4; cursor: not-allowed; }`;
const ColumnMenu = styled.div`position: absolute; right: 0; top: 38px; z-index: 30; width: 150px; padding: 8px; border: ${border}; border-radius: 5px; background: #fff; box-shadow: 0 8px 22px rgba(15,23,42,.14); label { display: flex; gap: 8px; align-items: center; padding: 6px; cursor: pointer; }`;
const Filters = styled.div`min-width: 0; display: flex; align-items: center; gap: 8px;`;
const DateRange = styled.div`height: 34px; display: flex; align-items: center; border: ${border}; border-radius: 5px; background: #fff; overflow: hidden; input { width: 128px; height: 100%; padding: 0 9px; border: 0; color: #566176; outline: 0; font-size: 11px; } span { color: #8a94a7; }`;
const FilterField = styled.label`height: 34px; display: flex; align-items: center; border: ${border}; border-radius: 5px; background: #fff; overflow: hidden; > span { padding-left: 10px; color: #5b667a; white-space: nowrap; } select { width: 100px; height: 100%; padding: 0 8px; border: 0; color: #233047; background: #fff; outline: 0; font-size: 12px; }`;
const SearchBox = styled.label`height: 34px; width: 190px; display: flex; align-items: center; border: ${border}; border-radius: 5px; background: #fff; input { min-width: 0; flex: 1; height: 100%; padding: 0 10px; border: 0; outline: 0; font-size: 12px; } svg { margin-right: 9px; color: #7b879c; }`;
const Workspace = styled.div`min-height: 0; display: grid; grid-template-columns: 460px minmax(500px, 1fr) 390px; grid-template-rows: minmax(0, 1fr) 96px; gap: 9px;`;
const Panel = styled.section`min-width: 0; min-height: 0; border: ${border}; border-radius: 6px; background: #fff; overflow: hidden;`;
const ListPanel = styled(Panel)`grid-column: 1; grid-row: 1; display: grid; grid-template-rows: 38px minmax(0, 1fr) 40px;`;
const ListSummary = styled.div`display: flex; align-items: center; padding: 0 12px; border-bottom: ${border}; color: #657086; strong { color: #1d2a41; margin: 0 3px; }`;
const AlarmTable = styled.div`min-height: 0; display: grid; grid-template-rows: 34px minmax(0, 1fr); --cols: ${p => [p.$visible.includes("time") && "122px", p.$visible.includes("type") && "94px", p.$visible.includes("level") && "70px", p.$visible.includes("subject") && "minmax(70px,1fr)", p.$visible.includes("status") && "62px"].filter(Boolean).join(" ")};`;
const TableHeader = styled.div`display: grid; grid-template-columns: var(--cols); align-items: center; gap: 4px; padding: 0 10px; color: #657086; background: #fafbfc; border-bottom: ${border}; font-weight: 600;`;
const TableBody = styled.div`position: relative; min-height: 0; overflow: hidden; display: flex; flex-direction: column;`;
const TableRow = styled.button`min-height: 0; flex: 1 1 0; width: 100%; display: grid; grid-template-columns: var(--cols); align-items: center; gap: 4px; padding: 0 10px; border: 0; border-bottom: ${border}; color: #536078; background: ${p => p.$selected ? "#eff6ff" : "#fff"}; box-shadow: ${p => p.$selected ? "inset 3px 0 #1677ff" : "none"}; text-align: left; cursor: pointer; font-size: 10px; overflow: hidden; > span, > strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } > strong { color: #334057; font-weight: 600; } &:hover { background: #f6f9fd; }`;
const Level = styled.span`display: inline-flex; height: 20px; padding: 0 7px; align-items: center; border-radius: 3px; color: ${p => ({ critical: "#b42318", danger: "#d92d20", warning: "#b54708", normal: "#1769aa" }[p.$tone])}; background: ${p => ({ critical: "#fee4e2", danger: "#fff0ee", warning: "#fff4e5", normal: "#edf6ff" }[p.$tone])}; font-size: 10px; font-weight: 700;`;
const Status = styled.span`display: inline-flex; height: 20px; align-items: center; color: ${p => ["关闭", "误报"].includes(p.$status) ? "#28855b" : p.$status === "待复核" ? "#7a5af8" : "#1677ff"}; background: ${p => ["关闭", "误报"].includes(p.$status) ? "#ecfdf3" : p.$status === "待复核" ? "#f4f3ff" : "#eff6ff"}; border-radius: 3px; padding: 0 6px; font-size: 10px; white-space: nowrap;`;
const Pagination = styled.div`display: flex; align-items: center; justify-content: center; gap: 10px; border-top: ${border}; color: #687389; ${IconButton} { width: 27px; height: 27px; }`;
const Centered = styled.div`position: absolute; inset: 0; display: grid; place-items: center; color: ${p => p.$error ? "#d92d20" : "#7a869a"}; background: #fff;`;
const MapPanel = styled(Panel)`grid-column: 2; grid-row: 1; position: relative;`;
const MapTabs = styled.div`position: absolute; z-index: 12; top: 12px; left: 52px; display: flex; border: ${border}; border-radius: 5px; overflow: hidden; box-shadow: 0 3px 10px rgba(15,23,42,.14); button { height: 30px; padding: 0 12px; display: flex; gap: 5px; align-items: center; border: 0; border-right: ${border}; color: #5d687c; background: rgba(255,255,255,.96); cursor: pointer; &:last-child { border-right: 0; } &.active { color: #1677ff; background: #eff6ff; font-weight: 700; } }`;
const MapLegend = styled.div`position: absolute; z-index: 10; left: 50%; bottom: 12px; transform: translateX(-50%); height: 34px; padding: 0 12px; display: flex; align-items: center; gap: 16px; border: ${border}; border-radius: 5px; background: rgba(255,255,255,.94); box-shadow: 0 4px 14px rgba(15,23,42,.15); color: #536078; white-space: nowrap; span { display: flex; gap: 5px; align-items: center; } i { width: 8px; height: 8px; border-radius: 50%; background: #f5b942; &.area { border: 2px solid #ef4444; background: rgba(239,68,68,.25); border-radius: 2px; width: 11px; height: 11px; } &.critical { background: #b42318; } &.danger { background: #f97316; } }`;
const DetailPanel = styled(Panel)`grid-column: 3; grid-row: 1 / 3; display: grid; grid-template-rows: auto minmax(0,1fr) auto; position: relative;`;
const DetailHeader = styled.div`padding: 12px 14px; border-bottom: ${border}; background: ${p => p.$tone === "critical" ? "#fff1f0" : p.$tone === "danger" ? "#fff7ed" : "#f4f8ff"}; > div { display: flex; align-items: center; gap: 8px; color: #1d2939; font-size: 14px; svg { color: #ef4444; } } > span { margin-top: 8px; display: flex; align-items: center; gap: 4px; color: #778298; font-size: 10px; ${IconButton} { width: 22px; height: 22px; background: transparent; border: 0; } }`;
const DetailScroll = styled.div`min-height: 0; overflow-y: auto; padding: 0 14px 14px;`;
const InfoRows = styled.div`padding: 4px 0;`;
const InfoRow = styled.div`min-height: 38px; display: grid; grid-template-columns: 84px 1fr; align-items: center; border-bottom: ${border}; > span:first-child { color: #69758a; } > strong { color: #2e3a50; font-weight: 600; }`;
const DetailSection = styled.section`padding-top: 12px; h3 { margin-bottom: 7px; color: #27344b; font-size: 12px; } p { color: #667187; line-height: 1.6; }`;
const Advice = styled.div`padding: 9px 10px; border-left: 3px solid #1677ff; color: #536078; background: #f4f8ff; line-height: 1.6;`;
const Assignment = styled.div`display: flex; gap: 8px; align-items: center; margin-bottom: 6px; color: #1677ff; > div { display: flex; flex-direction: column; gap: 2px; color: #2b374d; span { color: #7a869b; font-size: 10px; } }`;
const Feedback = styled.div`margin-top: 7px; padding: 7px; color: #237a53; background: #ecfdf3; line-height: 1.5;`;
const ResourceTags = styled.div`display: flex; flex-wrap: wrap; gap: 6px; span { max-width: 100%; height: 24px; padding: 0 7px; display: inline-flex; align-items: center; gap: 4px; color: #1769c2; background: #eff6ff; border-radius: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } em { color: #8892a4; font-style: normal; }`;
const VideoPreview = styled.div`position: relative; height: 105px; display: grid; place-items: center; overflow: hidden; color: #cbd5e1; background: linear-gradient(135deg,#27364a,#111827 55%,#344054); border-radius: 4px; > button { position: absolute; width: 38px; height: 38px; display: grid; place-items: center; border: 0; border-radius: 50%; color: #1677ff; background: rgba(255,255,255,.94); cursor: pointer; } > span { position: absolute; left: 8px; bottom: 6px; color: #fff; font-size: 10px; }`;
const DetailActions = styled.div`min-height: 56px; padding: 10px 12px; display: flex; justify-content: flex-end; align-items: center; gap: 8px; border-top: ${border}; background: #fff;`;
const PrimaryButton = styled.button`height: 34px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid #1677ff; border-radius: 5px; color: #fff; background: #1677ff; font-size: 12px; cursor: pointer; &:hover:not(:disabled) { background: #0866d8; } &:disabled { opacity: .5; cursor: not-allowed; }`;
const SecondaryButton = styled(PrimaryButton)`color: #4f5b70; border-color: #dce2ea; background: #fff; &:hover:not(:disabled) { color: #1677ff; background: #f7faff; }`;
const TerminalState = styled.span`display: inline-flex; align-items: center; gap: 6px; color: #28855b;`;
const ProcessPanel = styled(Panel)`grid-column: 1 / 3; grid-row: 2; padding: 10px 14px;`;
const ProcessTitle = styled.h2`margin-bottom: 8px; font-size: 12px;`;
const ProcessSteps = styled.div`display: grid; grid-template-columns: repeat(5, 1fr);`;
const ProcessStep = styled.div`position: relative; display: flex; align-items: flex-start; gap: 8px; color: ${p => p.$reached ? "#1677ff" : "#788399"};`;
const StepDot = styled.span`position: relative; z-index: 2; width: 26px; height: 26px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid currentColor; border-radius: 50%; color: inherit; background: #fff; font-weight: 700;`;
const StepCopy = styled.div`display: flex; flex-direction: column; gap: 3px; strong { color: #334057; font-size: 11px; } span { color: #8791a4; font-size: 9px; white-space: nowrap; }`;
const StepLine = styled.span`position: absolute; z-index: 1; top: 13px; left: 26px; right: 8px; height: 1px; background: ${p => p.$reached ? "#80b4f7" : "#dce2ea"};`;
const ModalBackdrop = styled.div`position: fixed; inset: 0; z-index: 1300; display: grid; place-items: center; background: rgba(15,23,42,.46);`;
const Dialog = styled.div`width: 470px; border-radius: 6px; background: #fff; box-shadow: 0 20px 60px rgba(15,23,42,.28); overflow: hidden;`;
const DialogHeader = styled.div`height: 48px; padding: 0 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: ${border}; font-size: 14px; ${IconButton} { border: 0; }`;
const DialogBody = styled.div`padding: 14px; display: grid; gap: 12px;`;
const ActionNotice = styled.div`padding: 8px 10px; border-left: 3px solid #1677ff; color: #536078; background: #f4f8ff; line-height: 1.5;`;
const Field = styled.label`display: grid; gap: 6px; color: #4b576c; font-size: 11px; input, select, textarea { width: 100%; border: ${border}; border-radius: 4px; color: #27344a; background: #fff; outline: 0; font-size: 12px; } input, select { height: 34px; padding: 0 8px; } textarea { height: 82px; padding: 8px; resize: vertical; }`;
const FieldError = styled.div`min-height: 34px; padding: 8px 10px; border: 1px solid #fecdca; border-radius: 4px; color: #b42318; background: #fff4f2;`;
const FieldRow = styled.div`display: grid; grid-template-columns: 130px 1fr; gap: 10px;`;
const DialogFooter = styled.div`height: 56px; padding: 0 14px; display: flex; justify-content: flex-end; align-items: center; gap: 8px; border-top: ${border}; background: #fafbfc;`;
const Toast = styled.div`position: fixed; z-index: 1400; left: 50%; top: 68px; transform: translateX(-50%); padding: 9px 15px; border-radius: 5px; color: #fff; background: rgba(23,32,51,.92); box-shadow: 0 6px 18px rgba(15,23,42,.2);`;
const AuditList = styled.ul`list-style: none; display: grid; gap: 9px; li { display: grid; grid-template-columns: 8px 1fr; gap: 8px; align-items: start; } li > i { width: 7px; height: 7px; margin-top: 5px; border-radius: 50%; background: #1677ff; } li > div { min-width: 0; display: grid; gap: 2px; } strong { color: #344054; font-size: 11px; } span { color: #8791a4; font-size: 9px; } p { color: #667187; font-size: 10px; line-height: 1.45; }`;

export default AlarmCenter;
