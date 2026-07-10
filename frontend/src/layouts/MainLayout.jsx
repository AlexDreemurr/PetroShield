import React from "react";
import Header from "../components/Header/Header";
import LeftBar from "../components/LeftBar/LeftBar";
import { Outlet } from "react-router";
import styled from "styled-components";

function MainLayout() {
  return (
    <Wrapper>
      <Header />
      <ContentWrapper>
        <LeftBar />

        <Main>
          <Outlet />
        </Main>
      </ContentWrapper>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;
const ContentWrapper = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  height: 100%;
`;
const Main = styled.main`
  flex: 1;
  height: 100%;
`;
export default MainLayout;
