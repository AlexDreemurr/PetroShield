import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import Icon from "../Icon/Icon";
import styled from "styled-components";
import { COLORS, FONT_SIZES } from "../../constants/STYLES";
import { useAuth } from "../../auth/authStore";

const navItems = [
  { to: "/", icon: "House", label: "首页", permission: "dashboard.view" },
  { to: "/people-management", icon: "UsersRound", label: "人员管理", permission: "people.view" },
  { to: "/alarm-center", icon: "Siren", label: "告警中心", permission: "alarms.view" },
  { to: "/device-management", icon: "Cpu", label: "设备管理", permission: "devices.view" },
  { to: "/risk-control", icon: "ShieldAlert", label: "风险管控", permission: "risk.view" },
  { to: "/video-ai", icon: "Cctv", label: "视频AI", permission: "video.view" },
  {
    icon: "ChartColumn",
    label: "统计分析",
    path: "/statistics-analysis",
    children: [
      { to: "/statistics-analysis/risk-overview", label: "风险态势总览", permission: "statistics.view" },
      { to: "/statistics-analysis/risk-events", label: "风险事件追溯", permission: "statistics.view" },
      { to: "/statistics-analysis/alarm-stats", label: "告警统计分析", permission: "statistics.view" },
      { to: "/statistics-analysis/person-tracks", label: "人员轨迹分析", permission: "statistics.view" },
      { to: "/statistics-analysis/device-stats", label: "设备统计分析", permission: "statistics.view" },
    ],
  },
  {
    icon: "Settings",
    label: "系统管理",
    path: "/system-management",
    children: [
      { to: "/system-management/users", label: "用户管理", permission: "system.users.view" },
      { to: "/system-management/roles", label: "角色权限", permission: "system.roles.view" },
      { to: "/system-management/dictionaries", label: "数据字典", permission: "system.dictionaries.view" },
      { to: "/system-management/operation-logs", label: "操作日志", permission: "system.logs.view" },
      { to: "/system-management/api-config", label: "API配置", permission: "system.api.view" },
    ],
  },
];

function LeftBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => ({
    "/statistics-analysis": location.pathname.startsWith("/statistics-analysis"),
    "/system-management": location.pathname.startsWith("/system-management"),
  }));

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
      <NavScroll $isCollapsed={isCollapsed}>
        {navItems.map((item) => {
        if (item.permission && !hasPermission(item.permission)) return null;
        if (item.children) {
          const visibleChildren = item.children.filter((child) => hasPermission(child.permission));
          if (!visibleChildren.length) return null;
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
                onClick={() => handleDrawerClick({ ...item, children: visibleChildren })}
              >
                <Icon id={item.icon} size={18} />
                <Word $isCollapsed={isCollapsed}>{item.label}</Word>
                <ChevronIcon $isOpen={isOpen} $isCollapsed={isCollapsed}>
                  <Icon id="ChevronDown" size={15} strokeWidth={2} />
                </ChevronIcon>
              </DrawerTrigger>

              {!isCollapsed && isOpen && (
                <DrawerPanel>
                  {visibleChildren.map((child) => (
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
      </NavScroll>

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
  height: 100%;
  min-height: 0;
  padding: 16px 8px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-right: 1px ${COLORS.gray90} solid;
  transition: width 180ms ease;
`;

const NavScroll = styled.nav`
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-x: hidden;
  overflow-y: ${(p) => (p.$isCollapsed ? "hidden" : "auto")};
  padding-right: ${(p) => (p.$isCollapsed ? "0" : "2px")};
  scrollbar-width: thin;
  scrollbar-color: hsl(218 15% 78%) transparent;

  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-thumb { background: hsl(218 15% 78%); border-radius: 4px; }
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

  flex: 0 0 auto;
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
