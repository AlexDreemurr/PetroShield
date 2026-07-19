import GlobalStyles from "./GlobalStyles";
import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import Dashboard from "./pages/Dashboard";
import MainLayout from "./layouts/MainLayout";
import PeopleManagement from "./pages/PeopleManagement";
import AlarmCenter from "./pages/AlarmCenter";
import DeviceManagement from "./pages/DeviceManagement";
import RiskControl from "./pages/RiskControl";
import VideoAI from "./pages/VideoAI";
import StatisticsAnalysis from "./pages/StatisticsAnalysis";
import StatisticsPlaceholder from "./pages/StatisticsPlaceholder";
import RiskEventTraceability from "./pages/RiskEventTraceability";
import UserManagement from "./pages/UserManagement";
import RolePermission from "./pages/RolePermission";
import DataDictionary from "./pages/DataDictionary";
import OperationLogs from "./pages/OperationLogs";
import ApiConfiguration from "./pages/ApiConfiguration";
import Login from "./pages/Login";
import NoPermission from "./pages/NoPermission";
import { useAuth } from "./auth/authStore";
import styled from "styled-components";

function App() {
  return (
    <Wrapper>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
          <Route path="/no-permission" element={<NoPermission />} />
          <Route path="/" element={<PermissionPage code="dashboard.view"><Dashboard /></PermissionPage>} />
          <Route path="/people-management" element={<PermissionPage code="people.view"><PeopleManagement /></PermissionPage>} />
          <Route path="/alarm-center" element={<PermissionPage code="alarms.view"><AlarmCenter /></PermissionPage>} />
          <Route path="/device-management" element={<PermissionPage code="devices.view"><DeviceManagement /></PermissionPage>} />
          <Route path="/risk-control" element={<PermissionPage code="risk.view"><RiskControl /></PermissionPage>} />
          <Route path="/video-ai" element={<PermissionPage code="video.view"><VideoAI /></PermissionPage>} />
          <Route
            path="/statistics-analysis"
            element={<Navigate to="/statistics-analysis/risk-overview" replace />}
          />
          <Route
            path="/statistics-analysis/risk-overview"
            element={<PermissionPage code="statistics.view"><StatisticsAnalysis /></PermissionPage>}
          />
          <Route
            path="/statistics-analysis/risk-events"
            element={<PermissionPage code="statistics.view"><RiskEventTraceability /></PermissionPage>}
          />
          <Route
            path="/statistics-analysis/alarm-stats"
            element={<PermissionPage code="statistics.view"><StatisticsPlaceholder title="告警统计分析" /></PermissionPage>}
          />
          <Route
            path="/statistics-analysis/person-tracks"
            element={<PermissionPage code="statistics.view"><StatisticsPlaceholder title="人员轨迹分析" /></PermissionPage>}
          />
          <Route
            path="/statistics-analysis/device-stats"
            element={<PermissionPage code="statistics.view"><StatisticsPlaceholder title="设备统计分析" /></PermissionPage>}
          />
          <Route
            path="/system-management"
            element={<SystemIndex />}
          />
          <Route
            path="/system-management/users"
            element={<PermissionPage code="system.users.view"><UserManagement /></PermissionPage>}
          />
          <Route
            path="/system-management/roles"
            element={<PermissionPage code="system.roles.view"><RolePermission /></PermissionPage>}
          />
          <Route
            path="/system-management/dictionaries"
            element={<PermissionPage code="system.dictionaries.view"><DataDictionary /></PermissionPage>}
          />
          <Route
            path="/system-management/operation-logs"
            element={<PermissionPage code="system.logs.view"><OperationLogs /></PermissionPage>}
          />
          <Route
            path="/system-management/api-config"
            element={<PermissionPage code="system.api.view"><ApiConfiguration /></PermissionPage>}
          />
        </Route>
      </Routes>
      <GlobalStyles />
    </Wrapper>
  );
}

function RequireAuth({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <AuthLoading>正在校验登录状态...</AuthLoading>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

function PermissionPage({ code, children }) {
  const { hasPermission } = useAuth();
  return hasPermission(code) ? children : <Navigate to="/no-permission" replace />;
}

function SystemIndex() {
  const { hasPermission } = useAuth();
  const candidates = [
    ["system.users.view", "/system-management/users"],
    ["system.roles.view", "/system-management/roles"],
    ["system.dictionaries.view", "/system-management/dictionaries"],
    ["system.logs.view", "/system-management/operation-logs"],
    ["system.api.view", "/system-management/api-config"],
  ];
  const target = candidates.find(([permission]) => hasPermission(permission))?.[1];
  return <Navigate to={target || "/no-permission"} replace />;
}

const AuthLoading = styled.div`
  height: 100%;
  display: grid;
  place-items: center;
  color: hsl(218 10% 48%);
  background: hsl(216 26% 97%);
  font-size: 12px;
`;
const Wrapper = styled.div`
  height: 100%;
`;
export default App;
