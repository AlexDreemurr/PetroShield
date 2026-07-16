import React from "react";
import styled from "styled-components";
import { COLORS, FONT_SIZES } from "../constants/STYLES";

function StatisticsPlaceholder({ title }) {
  return (
    <Wrapper>
      <PageTitle>{title}</PageTitle>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  min-height: 100%;
  padding: 16px 18px;
  background: hsl(216 26% 97%);
`;

const PageTitle = styled.h1`
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.peoplePageTitle};
  font-weight: 700;
`;

export default StatisticsPlaceholder;
