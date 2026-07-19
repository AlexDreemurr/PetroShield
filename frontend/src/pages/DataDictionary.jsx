import React, { useMemo, useState } from "react";
import { BookOpen, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import styled from "styled-components";
import { BUSINESS_PAGE_LAYOUT, COLORS, FONT_SIZES } from "../constants/STYLES";

const INITIAL_GROUPS = [
  { id: "alarm_type", name: "告警类型", description: "告警识别与统计分类", items: [
    { id: 1, code: "AREA_INTRUSION", name: "区域入侵", color: "#ef4444", order: 10, status: "启用", remark: "人员进入未授权风险区域" },
    { id: 2, code: "PPE_MISSING", name: "未佩戴安全帽", color: "#f59e0b", order: 20, status: "启用", remark: "视频AI识别防护用品缺失" },
    { id: 3, code: "DEVICE_OFFLINE", name: "设备离线", color: "#64748b", order: 30, status: "启用", remark: "设备心跳超时" },
  ]},
  { id: "risk_level", name: "风险等级", description: "风险区域与事件等级", items: [
    { id: 4, code: "SEVERE", name: "严重", color: "#dc2626", order: 10, status: "启用", remark: "立即处置并升级上报" },
    { id: 5, code: "MEDIUM", name: "中等", color: "#f59e0b", order: 20, status: "启用", remark: "限时确认并派发" },
    { id: 6, code: "GENERAL", name: "一般", color: "#3b82f6", order: 30, status: "启用", remark: "常规处理" },
  ]},
  { id: "person_type", name: "人员类型", description: "人员档案身份分类", items: [
    { id: 7, code: "EMPLOYEE", name: "员工", color: "#2563eb", order: 10, status: "启用", remark: "企业正式员工" },
    { id: 8, code: "CONTRACTOR", name: "承包商", color: "#8b5cf6", order: 20, status: "启用", remark: "外协及施工人员" },
    { id: 9, code: "VISITOR", name: "访客", color: "#14b8a6", order: 30, status: "启用", remark: "临时入厂人员" },
  ]},
  { id: "device_type", name: "设备类型", description: "设备台账分类", items: [
    { id: 10, code: "CAMERA", name: "视频设备", color: "#2563eb", order: 10, status: "启用", remark: "固定或移动摄像头" },
    { id: 11, code: "SENSOR", name: "传感器", color: "#10b981", order: 20, status: "启用", remark: "环境及工艺传感设备" },
    { id: 12, code: "ACCESS", name: "门禁设备", color: "#f59e0b", order: 30, status: "启用", remark: "闸机及门禁控制器" },
  ]},
  { id: "area_type", name: "区域类型", description: "电子围栏管控类型", items: [
    { id: 13, code: "DANGER", name: "危险区域", color: "#dc2626", order: 10, status: "启用", remark: "需要授权进入" },
    { id: 14, code: "RESTRICTED", name: "限制区域", color: "#d97706", order: 20, status: "启用", remark: "限制人员或时段" },
    { id: 15, code: "NORMAL", name: "普通区域", color: "#15803d", order: 30, status: "停用", remark: "仅用于位置归属" },
  ]},
];

const EMPTY_ITEM = { code: "", name: "", color: "#2563eb", order: 10, status: "启用", remark: "" };

function ItemDialog({ item, onClose, onSubmit }) {
  const [form, setForm] = useState(item ?? EMPTY_ITEM);
  const [error, setError] = useState("");
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  function submit(event) { event.preventDefault(); if (!form.code.trim() || !form.name.trim()) { setError("请填写字典编码和名称"); return; } onSubmit({ ...form, code: form.code.trim().toUpperCase(), name: form.name.trim(), order: Number(form.order) || 0 }); }
  return <Backdrop onMouseDown={onClose}><Dialog onMouseDown={(event) => event.stopPropagation()}><DialogHeader><div><h2>{item ? "编辑字典项" : "新增字典项"}</h2><p>编码保存后建议保持稳定，避免影响历史数据</p></div><IconButton type="button" title="关闭" onClick={onClose}><X size={17} /></IconButton></DialogHeader><DialogForm onSubmit={submit}><FormGrid><Field><span>字典编码</span><input value={form.code} disabled={Boolean(item)} onChange={update("code")} placeholder="例如 DEVICE_OFFLINE" /></Field><Field><span>显示名称</span><input value={form.name} onChange={update("name")} placeholder="请输入显示名称" /></Field><Field><span>显示颜色</span><ColorInput><input type="color" value={form.color} onChange={update("color")} /><input value={form.color} onChange={update("color")} /></ColorInput></Field><Field><span>排序值</span><input type="number" min="0" value={form.order} onChange={update("order")} /></Field><Field><span>状态</span><select value={form.status} onChange={update("status")}><option>启用</option><option>停用</option></select></Field><Field $wide><span>说明</span><input value={form.remark} onChange={update("remark")} placeholder="请输入业务含义或使用范围" /></Field></FormGrid>{error ? <ErrorText>{error}</ErrorText> : null}<DialogActions><SecondaryButton type="button" onClick={onClose}>取消</SecondaryButton><PrimaryButton type="submit">保存</PrimaryButton></DialogActions></DialogForm></Dialog></Backdrop>;
}

function DataDictionary() {
  const [groups, setGroups] = useState(INITIAL_GROUPS);
  const [selectedId, setSelectedId] = useState(INITIAL_GROUPS[0].id);
  const [keyword, setKeyword] = useState("");
  const [dialogItem, setDialogItem] = useState(undefined);
  const [notice, setNotice] = useState("");
  const selectedGroup = groups.find((group) => group.id === selectedId) ?? groups[0];
  const items = useMemo(() => selectedGroup.items.filter((item) => !keyword.trim() || [item.code, item.name, item.remark].some((value) => value.toLowerCase().includes(keyword.trim().toLowerCase()))).sort((a, b) => a.order - b.order), [keyword, selectedGroup]);
  function notify(message) { setNotice(message); window.setTimeout(() => setNotice(""), 2000); }
  function saveItem(form) { setGroups((current) => current.map((group) => group.id !== selectedId ? group : { ...group, items: dialogItem ? group.items.map((item) => item.id === dialogItem.id ? { ...item, ...form } : item) : [...group.items, { ...form, id: Date.now() }] })); notify(dialogItem ? "字典项已更新" : "字典项已新增"); setDialogItem(undefined); }
  function toggleItem(target) { setGroups((current) => current.map((group) => group.id !== selectedId ? group : { ...group, items: group.items.map((item) => item.id === target.id ? { ...item, status: item.status === "启用" ? "停用" : "启用" } : item) })); }
  function deleteItem(target) { if (!window.confirm(`确定删除字典项“${target.name}”吗？`)) return; setGroups((current) => current.map((group) => group.id !== selectedId ? group : { ...group, items: group.items.filter((item) => item.id !== target.id) })); notify("字典项已删除"); }
  return <Page><PageHeader><div><PageTitle>数据字典</PageTitle><PageSubtitle>统一维护平台枚举值、业务编码与显示规则</PageSubtitle></div><PrimaryButton type="button" onClick={() => setDialogItem(null)}><Plus size={15} />新增字典项</PrimaryButton></PageHeader><Workspace><GroupPanel><PanelHeader><strong>字典分类</strong><span>{groups.length} 个分类</span></PanelHeader><GroupList>{groups.map((group) => <GroupButton key={group.id} type="button" $active={group.id === selectedId} onClick={() => { setSelectedId(group.id); setKeyword(""); }}><BookOpen size={16} /><span><strong>{group.name}</strong><small>{group.description}</small></span><b>{group.items.length}</b></GroupButton>)}</GroupList></GroupPanel><ContentPanel><ContentHeader><div><h2>{selectedGroup.name}</h2><p>{selectedGroup.description}</p></div><SearchBox><Search size={15} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索编码、名称或说明" /></SearchBox></ContentHeader><TableWrap><Table><thead><tr><th>排序</th><th>字典编码</th><th>显示名称</th><th>颜色</th><th>状态</th><th>说明</th><th>操作</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.order}</td><td><Code>{item.code}</Code></td><td>{item.name}</td><td><ColorCell><i style={{ background: item.color }} />{item.color}</ColorCell></td><td><Status $enabled={item.status === "启用"}><i />{item.status}</Status></td><td title={item.remark}>{item.remark || "--"}</td><td><Actions><IconButton type="button" title="编辑字典项" onClick={() => setDialogItem(item)}><Pencil size={14} /></IconButton><TextButton type="button" onClick={() => toggleItem(item)}>{item.status === "启用" ? "停用" : "启用"}</TextButton><IconButton type="button" title="删除字典项" $danger onClick={() => deleteItem(item)}><Trash2 size={14} /></IconButton></Actions></td></tr>)}{!items.length ? <tr><EmptyCell colSpan="7">没有符合条件的字典项</EmptyCell></tr> : null}</tbody></Table></TableWrap><PanelFooter><span>共 {selectedGroup.items.length} 项，当前显示 {items.length} 项</span><span>修改字典编码可能影响历史数据映射</span></PanelFooter></ContentPanel></Workspace>{dialogItem !== undefined ? <ItemDialog item={dialogItem} onClose={() => setDialogItem(undefined)} onSubmit={saveItem} /> : null}{notice ? <Toast>{notice}</Toast> : null}</Page>;
}

const Page = styled.div`height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);gap:10px;padding:${BUSINESS_PAGE_LAYOUT.padding};overflow:hidden;background:hsl(216 26% 97%);color:hsl(218 22% 22%);`;
const PageHeader = styled.header`display:flex;align-items:center;justify-content:space-between;gap:16px;`;
const PageTitle = styled.h1`margin:0;color:${COLORS.gray10};font-size:${FONT_SIZES.peoplePageTitle};line-height:${BUSINESS_PAGE_LAYOUT.titleLineHeight};`;
const PageSubtitle = styled.p`margin-top:4px;color:hsl(218 10% 48%);font-size:11px;`;
const Workspace = styled.div`min-height:0;display:grid;grid-template-columns:270px minmax(0,1fr);gap:10px;`;
const GroupPanel = styled.aside`min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);border:1px solid hsl(218 18% 88%);border-radius:6px;background:white;overflow:hidden;`;
const PanelHeader = styled.header`height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid hsl(218 18% 90%);strong{font-size:13px}span{color:hsl(218 10% 50%);font-size:10px}`;
const GroupList = styled.div`min-height:0;overflow:auto;padding:7px;`;
const GroupButton = styled.button`width:100%;min-height:58px;display:grid;grid-template-columns:22px minmax(0,1fr) auto;align-items:center;gap:9px;margin-bottom:4px;padding:8px 10px;border:0;border-radius:5px;text-align:left;color:${(p) => p.$active ? "hsl(220 84% 45%)" : "hsl(218 18% 30%)"};background:${(p) => p.$active ? "hsl(220 90% 95%)" : "transparent"};cursor:pointer;&:hover{background:hsl(216 34% 96%)}span{min-width:0}strong{display:block;font-size:12px}small{display:block;margin-top:4px;color:hsl(218 10% 52%);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}b{min-width:22px;height:20px;display:grid;place-items:center;border-radius:10px;background:white;font-size:10px}`;
const ContentPanel = styled.section`min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:1px solid hsl(218 18% 88%);border-radius:6px;background:white;overflow:hidden;`;
const ContentHeader = styled.header`height:64px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 16px;border-bottom:1px solid hsl(218 18% 90%);h2{margin:0;font-size:15px}p{margin-top:4px;color:hsl(218 10% 48%);font-size:11px}`;
const control = `height:34px;border:1px solid hsl(220 13% 84%);border-radius:6px;background:white;color:hsl(218 18% 25%);font-size:12px;outline:none;&:focus{border-color:hsl(220 88% 58%);box-shadow:0 0 0 2px hsl(220 90% 94%);}`;
const SearchBox = styled.label`${control} width:320px;display:flex;align-items:center;gap:8px;padding:0 10px;color:hsl(218 10% 52%);input{min-width:0;flex:1;border:0;outline:0;background:transparent;font-size:12px}`;
const TableWrap = styled.div`min-height:0;overflow:auto;`;
const Table = styled.table`width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;th{position:sticky;top:0;z-index:1;height:38px;padding:0 12px;text-align:left;background:hsl(216 28% 97%);color:hsl(218 12% 42%);font-weight:600;border-bottom:1px solid hsl(218 18% 88%)}td{height:52px;padding:0 12px;border-bottom:1px solid hsl(218 18% 92%);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}th:nth-child(1){width:7%}th:nth-child(2){width:17%}th:nth-child(3){width:13%}th:nth-child(4){width:13%}th:nth-child(5){width:9%}th:nth-child(6){width:22%}th:nth-child(7){width:19%}tbody tr:hover{background:hsl(216 55% 98%)}`;
const Code = styled.code`font-family:var(--font-data);font-size:11px;color:hsl(220 65% 40%);`;
const ColorCell = styled.span`display:flex;align-items:center;gap:7px;font-family:var(--font-data);font-size:10px;i{width:16px;height:16px;border-radius:3px;border:1px solid rgba(15,23,42,.12)}`;
const Status = styled.span`display:inline-flex;align-items:center;gap:6px;color:${(p) => p.$enabled ? "hsl(157 64% 34%)" : "hsl(218 10% 50%)"};i{width:6px;height:6px;border-radius:50%;background:currentColor}`;
const Actions = styled.div`display:flex;align-items:center;gap:5px;`;
const PrimaryButton = styled.button`height:34px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 14px;border:0;border-radius:6px;color:white;background:${COLORS.blue};font-size:12px;cursor:pointer;&:hover{background:hsl(220 90% 44%)}`;
const SecondaryButton = styled.button`height:34px;padding:0 16px;border:1px solid hsl(218 18% 84%);border-radius:6px;background:white;color:hsl(218 16% 30%);font-size:12px;cursor:pointer;`;
const IconButton = styled.button`width:30px;height:30px;display:grid;place-items:center;border:1px solid hsl(218 18% 86%);border-radius:5px;color:${(p) => p.$danger ? "hsl(2 70% 48%)" : "hsl(218 14% 42%)"};background:white;cursor:pointer;&:hover{border-color:hsl(220 76% 72%);color:${COLORS.blue}}`;
const TextButton = styled.button`height:30px;padding:0 9px;border:0;border-radius:5px;color:hsl(218 16% 38%);background:hsl(218 18% 94%);font-size:11px;cursor:pointer;`;
const EmptyCell = styled.td`height:180px!important;text-align:center;color:hsl(218 10% 52%);`;
const PanelFooter = styled.footer`height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-top:1px solid hsl(218 18% 90%);color:hsl(218 10% 50%);font-size:10px;`;
const Backdrop = styled.div`position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(15,23,42,.42);`;
const Dialog = styled.section`width:560px;border-radius:7px;background:white;box-shadow:0 18px 46px rgba(15,23,42,.22);overflow:hidden;`;
const DialogHeader = styled.header`display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid hsl(218 18% 90%);h2{font-size:16px;margin:0}p{margin-top:4px;color:hsl(218 10% 48%);font-size:11px}`;
const DialogForm = styled.form`padding:18px 20px;`;
const FormGrid = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;`;
const Field = styled.label`display:grid;grid-column:${(p) => p.$wide ? "1/-1" : "auto"};gap:6px;color:hsl(218 14% 34%);font-size:12px;>input,select{${control} width:100%;padding:0 10px}input:disabled{background:hsl(218 16% 96%)}`;
const ColorInput = styled.div`display:grid;grid-template-columns:42px minmax(0,1fr);gap:6px;input{${control} width:100%;padding:0 8px}input[type=color]{padding:3px}`;
const ErrorText = styled.p`margin-top:12px;color:hsl(2 70% 48%);font-size:11px;`;
const DialogActions = styled.footer`display:flex;justify-content:flex-end;gap:8px;margin-top:20px;`;
const Toast = styled.div`position:fixed;right:24px;top:76px;z-index:1100;padding:10px 15px;border-radius:6px;color:white;background:hsl(218 28% 22%);box-shadow:0 8px 24px rgba(15,23,42,.18);font-size:12px;`;

export default DataDictionary;
