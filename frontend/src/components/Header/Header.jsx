import React from "react";
import styled from "styled-components";
import { COLORS } from "../../constants/STYLES";
import Icon from "../Icon/Icon";

function Header() {
  return (
    <Wrapper>
      <IconWrapper>
        <Icon id="ShieldCog" size={36} color={COLORS.blue} />
        <TitleWrapper>
          <Title>石安盾</Title>
          <TitleAbbr>petroshield</TitleAbbr>
        </TitleWrapper>
      </IconWrapper>

      <Name>石安盾多源融合安全监督平台</Name>
      <SearchInput></SearchInput>
      <ButtonGroups></ButtonGroups>
      <AvatarSelect></AvatarSelect>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  border-bottom: 1px ${COLORS.gray90} solid;
`;
const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: 5px 10px;
`;
const TitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;
const Title = styled.p`
  font-size: ${14 / 16}rem;
  font-weight: 500;
`;
const TitleAbbr = styled.p`
  font-size: ${8 / 16}rem;
  text-transform: uppercase;
`;
const Name = styled.p`
  font-weight: 500;
  margin-right: auto;
`;
const SearchInput = styled.input``;
const ButtonGroups = styled.div``;
const AvatarSelect = styled.div``;
export default Header;
