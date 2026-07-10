import GlobalStyles from "./GlobalStyles";
import React from "react";
import { Route, Routes } from "react-router";
import Dashboard from "./pages/Dashboard";
import MainLayout from "./layouts/MainLayout";
import PeopleManagement from "./pages/PeopleManagement";
import AlarmCenter from "./pages/AlarmCenter";
import DeviceManagement from "./pages/DeviceManagement";
import RiskControl from "./pages/RiskControl";
import VideoAI from "./pages/VideoAI";
import StatisticsAnalysis from "./pages/StatisticsAnalysis";
import SystemManagement from "./pages/SystemManagement";
import styled from "styled-components";

function App() {
  return (
    <Wrapper>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/people-management" element={<PeopleManagement />} />
          <Route path="/alarm-center" element={<AlarmCenter />} />
          <Route path="/device-management" element={<DeviceManagement />} />
          <Route path="/risk-control" element={<RiskControl />} />
          <Route path="/video-ai" element={<VideoAI />} />
          <Route path="/statistics-analysis" element={<StatisticsAnalysis />} />
          <Route
            path="/statistics-analysis/risk-overview"
            element={<StatisticsAnalysis title="风险态势总览" />}
          />
          <Route
            path="/statistics-analysis/risk-events"
            element={<StatisticsAnalysis title="风险事件追溯" />}
          />
          <Route
            path="/statistics-analysis/alarm-stats"
            element={<StatisticsAnalysis title="告警统计分析" />}
          />
          <Route
            path="/statistics-analysis/person-tracks"
            element={<StatisticsAnalysis title="人员轨迹分析" />}
          />
          <Route
            path="/statistics-analysis/device-stats"
            element={<StatisticsAnalysis title="设备统计分析" />}
          />
          <Route path="/system-management" element={<SystemManagement />} />
          <Route
            path="/system-management/user-settings"
            element={<SystemManagement title="用户设置" />}
          />
        </Route>
      </Routes>
      <GlobalStyles />
    </Wrapper>
  );
}
const Wrapper = styled.div`
  height: 100%;
`;
export default App;
