import React from "react";
import { NavLink } from "react-router";
import Icon from "../Icon/Icon";
import styled from "styled-components";
import { COLORS } from "../../constants/STYLES";

const navItems = [
  { to: "/", icon: "House", label: "首页" },
  { to: "/people-management", icon: "UsersRound", label: "人员管理" },
  { to: "/alarm-center", icon: "Siren", label: "告警中心" },
  { to: "/device-management", icon: "Cpu", label: "设备管理" },
  { to: "/risk-control", icon: "ShieldAlert", label: "风险管控" },
  { to: "/video-ai", icon: "Cctv", label: "视频AI" },
  { to: "/statistics-analysis", icon: "ChartColumn", label: "统计分析" },
  { to: "/system-management", icon: "Settings", label: "系统管理" },
];

function LeftBar() {
  return (
    <Wrapper>
      {navItems.map(({ to, icon, label }) => (
        <LinkWrapper key={to} to={to}>
          <Icon id={icon} size={18} />
          <Word>{label}</Word>
        </LinkWrapper>
      ))}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  width: 10rem;
  padding: 16px 8px 0 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-right: 1px ${COLORS.gray90} solid;
`;
const Word = styled.p``;
const LinkWrapper = styled(NavLink)`
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 8px 8px 8px 12px;
  border-radius: 4px;
  &:hover {
    background-color: ${COLORS.blue};
    color: white;
  }
  color: inherit;
  font-size: ${13 / 16}rem;
  text-decoration: none;
`;
export default LeftBar;
