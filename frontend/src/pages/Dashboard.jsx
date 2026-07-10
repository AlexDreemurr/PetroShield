import React from "react";
import styled from "styled-components";

function Card() {
  return <CardWrapper></CardWrapper>;
}

const CardWrapper = styled.div``;

function Dashboard() {
  return <Wrapper>Dashboard</Wrapper>;
}
const Wrapper = styled.div`
  background-color: hsl(0 0% 97.5%);
  height: 100%;
`;
export default Dashboard;
