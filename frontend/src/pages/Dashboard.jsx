import React, { useEffect, useState } from "react";
import styled from "styled-components";
import Icon from "../components/Icon/Icon";
import { COLORS } from "../constants/STYLES";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

const metricCards = [
  {
    key: "online_person_count",
    title: "在线人员",
    unit: "人",
    icon: "UsersRound",
    tone: "blue",
  },
  {
    key: "device_online_rate",
    title: "设备在线率",
    unit: "%",
    icon: "Cpu",
    tone: "green",
  },
  {
    key: "today_alarm_count",
    title: "今日告警总数",
    unit: "条",
    icon: "Siren",
    tone: "red",
  },
  {
    key: "risk_area_count",
    title: "风险区域",
    unit: "个",
    icon: "ShieldAlert",
    tone: "amber",
  },
];

function Card({ title, value, unit, icon, tone, isLoading, hasError }) {
  const displayValue = isLoading || hasError ? "--" : value;

  return (
    <CardWrapper>
      <CardTopLine>
        <IconBadge $tone={tone}>
          <Icon id={icon} size={18} strokeWidth={1.9} />
        </IconBadge>
        <CardTitle>{title}</CardTitle>
      </CardTopLine>
      <MetricLine>
        <MetricValue>{displayValue}</MetricValue>
        <MetricUnit>{unit}</MetricUnit>
      </MetricLine>
      <CardHint>{hasError ? "数据获取失败" : ""}</CardHint>
    </CardWrapper>
  );
}

function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadMetrics() {
      try {
        setHasError(false);
        const response = await fetch(`${API_BASE_URL}/dashboard/metrics`);

        if (!response.ok) {
          throw new Error("Failed to load dashboard metrics");
        }

        const data = await response.json();

        if (!ignore) {
          setMetrics(data);
        }
      } catch {
        if (!ignore) {
          setHasError(true);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadMetrics();
    const intervalId = window.setInterval(loadMetrics, 30000);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <Wrapper>
      <CardGrid>
        {metricCards.map((card) => (
          <Card
            key={card.key}
            {...card}
            value={metrics?.[card.key]}
            isLoading={isLoading}
            hasError={hasError}
          />
        ))}
      </CardGrid>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  min-height: 100%;
  background-color: hsl(0 0% 97.5%);
  padding: 24px;
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const CardWrapper = styled.article`
  min-height: 132px;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  background: hsl(0 0% 100%);
  padding: 16px;
`;

const CardTopLine = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const CardTitle = styled.p`
  font-size: ${13 / 16}rem;
  font-weight: 500;
`;

const IconBadge = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 100%;
  display: grid;
  place-items: center;
  color: white;
  background: ${(p) => toneColors[p.$tone].text};
`;

const MetricLine = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 18px;
`;

const MetricValue = styled.div`
  color: ${COLORS.gray10};
  font-family: var(--font-data);
  font-size: ${30 / 16}rem;
  font-weight: 600;
`;

const MetricUnit = styled.div`
  color: hsl(218 10% 45%);
  font-size: ${13 / 16}rem;
`;

const CardHint = styled.p`
  margin-top: 8px;
  color: hsl(218 10% 55%);
  font-size: ${12 / 16}rem;
`;

const toneColors = {
  blue: {
    text: COLORS.blue,
    background: "hsl(220 90% 50% / 0.1)",
  },
  green: {
    text: "hsl(152 70% 34%)",
    background: "hsl(152 70% 34% / 0.1)",
  },
  amber: {
    text: "hsl(38 92% 42%)",
    background: "hsl(38 92% 42% / 0.12)",
  },
  red: {
    text: "hsl(0 74% 48%)",
    background: "hsl(0 74% 48% / 0.1)",
  },
};

export default Dashboard;
