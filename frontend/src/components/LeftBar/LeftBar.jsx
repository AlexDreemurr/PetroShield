import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import Icon from "../Icon/Icon";
import styled from "styled-components";
import { COLORS, FONT_SIZES } from "../../constants/STYLES";

const navItems = [
  { to: "/", icon: "House", label: "首页" },
  { to: "/people-management", icon: "UsersRound", label: "人员管理" },
  { to: "/alarm-center", icon: "Siren", label: "告警中心" },
  { to: "/device-management", icon: "Cpu", label: "设备管理" },
  { to: "/risk-control", icon: "ShieldAlert", label: "风险管控" },
  { to: "/video-ai", icon: "Cctv", label: "视频AI" },
  {
    icon: "ChartColumn",
    label: "统计分析",
    path: "/statistics-analysis",
    children: [
      { to: "/statistics-analysis/risk-overview", label: "风险态势总览" },
      { to: "/statistics-analysis/risk-events", label: "风险事件追溯" },
      { to: "/statistics-analysis/alarm-stats", label: "告警统计分析" },
      { to: "/statistics-analysis/person-tracks", label: "人员轨迹分析" },
      { to: "/statistics-analysis/device-stats", label: "设备统计分析" },
    ],
  },
  {
    icon: "Settings",
    label: "系统管理",
    path: "/system-management",
    children: [{ to: "/system-management/user-settings", label: "用户设置" }],
  },
];

function LeftBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState({
    "/statistics-analysis": false,
    "/system-management": false,
  });

  const closeAllGroups = () => {
    setOpenGroups({
      "/statistics-analysis": false,
      "/system-management": false,
    });
  };

  const toggleGroup = (path) => {
    if (isCollapsed) return;

    setOpenGroups((current) => ({
      ...current,
      [path]: !current[path],
    }));
  };

  const handleDrawerClick = (item) => {
    if (isCollapsed) {
      navigate(item.children[0].to);
      return;
    }

    toggleGroup(item.path);
  };

  const handleMenuOpenerClick = () => {
    if (!isCollapsed) {
      closeAllGroups();
    }

    setIsCollapsed((current) => !current);
  };

  return (
    <Wrapper $isCollapsed={isCollapsed}>
      {navItems.map((item) => {
        if (item.children) {
          const isOpen = openGroups[item.path];
          const isActiveGroup = location.pathname.startsWith(item.path);

          return (
            <DrawerGroup key={item.path}>
              <DrawerTrigger
                type="button"
                title={item.label}
                $isActiveGroup={isActiveGroup}
                $isOpen={isOpen}
                $isCollapsed={isCollapsed}
                onClick={() => handleDrawerClick(item)}
              >
                <Icon id={item.icon} size={18} />
                <Word $isCollapsed={isCollapsed}>{item.label}</Word>
                <ChevronIcon $isOpen={isOpen} $isCollapsed={isCollapsed}>
                  <Icon id="ChevronDown" size={15} strokeWidth={2} />
                </ChevronIcon>
              </DrawerTrigger>

              {!isCollapsed && isOpen && (
                <DrawerPanel>
                  {item.children.map((child) => (
                    <SubLink key={child.to} to={child.to} end>
                      {child.label}
                    </SubLink>
                  ))}
                </DrawerPanel>
              )}
            </DrawerGroup>
          );
        }

        return (
          <LinkWrapper
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            title={item.label}
            $isCollapsed={isCollapsed}
            onClick={() => {
              if (isCollapsed) {
                closeAllGroups();
              }
            }}
          >
            <Icon id={item.icon} size={18} />
            <Word $isCollapsed={isCollapsed}>{item.label}</Word>
          </LinkWrapper>
        );
      })}

      <MenuOpener
        type="button"
        title={isCollapsed ? "展开菜单" : "收起菜单"}
        $isCollapsed={isCollapsed}
        onClick={handleMenuOpenerClick}
      >
        <Icon id="Menu" size={18} />
        <Word $isCollapsed={isCollapsed}>收起菜单</Word>
      </MenuOpener>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  width: ${(p) => (p.$isCollapsed ? "4rem" : "10rem")};
  padding: 16px 8px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-right: 1px ${COLORS.gray90} solid;
  transition: width 180ms ease;
`;

const Word = styled.p`
  grid-column: 2;
  min-width: 0;
  overflow: hidden;
  opacity: ${(p) => (p.$isCollapsed ? 0 : 1)};
  white-space: nowrap;
  text-align: left;
  transform: translateY(-1px);
  transition: opacity 120ms ease;
`;

const itemStyles = `
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  column-gap: 10px;
  padding: 8px 30px 8px 12px;
  border-radius: 4px;
  color: inherit;
  font-size: ${FONT_SIZES.navItem};
  text-decoration: none;
`;

const collapsedItemStyles = `
  grid-template-columns: 18px 0;
  column-gap: 0;
  padding-right: 12px;
`;

const LinkWrapper = styled(NavLink)`
  ${itemStyles}
  ${(p) => (p.$isCollapsed ? collapsedItemStyles : "")}

  &:hover,
  &.active {
    background-color: ${COLORS.blue};
    color: white;
  }
`;

const MenuOpener = styled.button`
  ${itemStyles}
  ${(p) => (p.$isCollapsed ? collapsedItemStyles : "")}

  margin-top: auto;
  background-color: transparent;
  border: none;

  &:hover {
    color: ${COLORS.blue};
    cursor: pointer;
  }
`;

const DrawerGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DrawerTrigger = styled.button`
  ${itemStyles}
  ${(p) => (p.$isCollapsed ? collapsedItemStyles : "")}
  border: none;
  background: ${(p) =>
    p.$isCollapsed && p.$isActiveGroup ? COLORS.blue : "transparent"};
  color: ${(p) =>
    p.$isOpen && !p.$isCollapsed
      ? COLORS.blue
      : p.$isCollapsed && p.$isActiveGroup
      ? "white"
      : "inherit"};
  text-align: left;

  &:hover {
    background-color: ${(p) => (p.$isCollapsed ? COLORS.blue : "transparent")};
    color: ${(p) => (p.$isCollapsed ? "white" : COLORS.blue)};
    cursor: pointer;
  }
`;

const ChevronIcon = styled.div`
  position: absolute;
  right: 8px;
  top: 50%;
  opacity: ${(p) => (p.$isCollapsed ? 0 : 1)};
  pointer-events: none;
  transform: translateY(-50%) rotate(${(p) => (p.$isOpen ? "180deg" : "0deg")});
  transition: opacity 120ms ease, transform 160ms ease;
`;

const DrawerPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SubLink = styled(NavLink)`
  display: block;
  border-radius: 4px;
  color: hsl(218 10% 38%);
  font-size: ${FONT_SIZES.navSubItem};
  line-height: 1.35;
  padding: 7px 8px 7px 34px;
  text-decoration: none;

  &:hover,
  &.active {
    background-color: ${COLORS.blue};
    color: white;
  }
`;

export default LeftBar;
