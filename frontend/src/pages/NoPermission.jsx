import React from "react";
import { ArrowLeft, ShieldX } from "lucide-react";
import { useNavigate } from "react-router";
import styled from "styled-components";
import { COLORS } from "../constants/STYLES";

function NoPermission() {
  const navigate = useNavigate();
  return <Page><ShieldX size={34} /><h1>无权访问此页面</h1><p>当前角色没有所需权限，请联系系统管理员调整角色权限。</p><button type="button" onClick={() => navigate(-1)}><ArrowLeft size={15} />返回上一页</button></Page>;
}
const Page = styled.div`height:100%;display:grid;place-content:center;justify-items:center;gap:10px;background:hsl(216 26% 97%);color:hsl(218 18% 28%);svg{color:hsl(218 14% 54%)}h1{font-size:17px}p{color:hsl(218 10% 50%);font-size:11px}button{height:34px;display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:0 13px;border:0;border-radius:5px;color:white;background:${COLORS.blue};font-size:11px;cursor:pointer}`;
export default NoPermission;
