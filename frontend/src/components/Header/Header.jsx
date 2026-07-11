import React, { useState } from "react";
import styled from "styled-components";
import { COLORS, FONT_SIZES } from "../../constants/STYLES";
import Icon from "../Icon/Icon";

function Header() {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <Wrapper>
      <IconWrapper>
        <Icon id="ShieldCog" size={36} color={COLORS.blue} />
        <TitleWrapper>
          <Title>石安盾</Title>
          <TitleAbbr>petroshield</TitleAbbr>
        </TitleWrapper>
      </IconWrapper>

      <Name>石安盾多源融合安全监管平台</Name>

      <SearchWrapper>
        <SearchIcon>
          <Icon id="Search" size={18} strokeWidth={1.8} />
        </SearchIcon>
        <SearchInput placeholder="搜索人员，设备，风险，事件等" />
      </SearchWrapper>

      <ButtonGroups>
        <Button>
          <Icon id="Bell" strokeWidth={1.8} size={20} />
        </Button>
        <Button>
          <Icon id="Mail" strokeWidth={1.8} size={20} />
        </Button>
        <Button>
          <Icon id="CircleQuestionMark" strokeWidth={1.8} size={20} />
        </Button>
      </ButtonGroups>

      <UserMenuWrapper>
        <AvatarSelect
          type="button"
          aria-haspopup="menu"
          aria-expanded={isUserMenuOpen}
          onClick={() => setIsUserMenuOpen((current) => !current)}
        >
          <Avatar>张</Avatar>
          <UserText>
            <UserName>张三</UserName>
            <UserRole>运营管理员</UserRole>
          </UserText>
          <ChevronIcon isOpen={isUserMenuOpen}>
            <Icon id="ChevronDown" size={16} strokeWidth={2} />
          </ChevronIcon>
        </AvatarSelect>

        {isUserMenuOpen && (
          <Menu role="menu">
            <MenuItem type="button" role="menuitem">
              用户设置
            </MenuItem>
            <MenuItem type="button" role="menuitem">
              退出登录
            </MenuItem>
          </Menu>
        )}
      </UserMenuWrapper>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  height: 50px;
  min-width: 0;
  border-bottom: 1px ${COLORS.gray90} solid;

  @media (max-width: 900px) {
    gap: 10px;
  }
`;

const IconWrapper = styled.div`
  display: flex;
  gap: 2px;
  align-items: center;
  padding: 8px 10px 8px 14px;

  @media (max-width: 760px) {
    padding-right: 6px;
  }
`;

const TitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 40px;

  @media (max-width: 900px) {
    margin-right: 12px;
  }
`;

const Title = styled.p`
  font-size: ${FONT_SIZES.brandTitle};
  font-weight: 500;
`;

const TitleAbbr = styled.p`
  font-size: ${FONT_SIZES.brandSubtitle};
  text-transform: uppercase;
`;

const Name = styled.p`
  font-weight: 500;
  margin-right: auto;
  white-space: nowrap;

  @media (max-width: 900px) {
    display: none;
  }
`;

const SearchWrapper = styled.div`
  position: relative;
  flex: 0 1 360px;
  min-width: 260px;
  color: hsl(218 10% 48%);

  @media (max-width: 900px) {
    flex: 1 1 180px;
    min-width: 160px;
  }

  @media (max-width: 760px) {
    display: none;
  }
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  height: 34px;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  background: hsl(0 0% 100%);
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.input};
  outline: none;
  padding: 0 14px 0 42px;
  transition: border-color 160ms ease, background-color 160ms ease,
    box-shadow 160ms ease;

  &::placeholder {
    color: hsl(218 10% 56%);
  }

  &:focus {
    border-color: hsl(220 70% 72%);
    background: hsl(0 0% 100%);
    box-shadow: 0 0 0 3px hsl(220 90% 50% / 0.12);
  }
`;

const ButtonGroups = styled.div`
  display: flex;
  gap: 12px;

  @media (max-width: 760px) {
    gap: 4px;
  }
`;

const Button = styled.button`
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background-color: transparent;

  &:hover {
    cursor: pointer;
    background: hsl(220 16% 96%);
  }
`;

const UserMenuWrapper = styled.div`
  position: relative;
`;

const AvatarSelect = styled.button`
  min-width: 130px;
  height: 44px;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px 4px 6px;
  background: hsl(0 0% 100%);
  color: ${COLORS.gray10};

  @media (max-width: 760px) {
    min-width: 58px;
    gap: 6px;
    padding: 4px 6px;
  }

  &:hover {
    cursor: pointer;
    background: hsl(220 16% 97%);
  }
`;

const Avatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  background: hsl(220 90% 50% / 0.12);
  color: ${COLORS.blue};
  font-size: ${FONT_SIZES.input};
  font-weight: 700;
`;

const UserText = styled.div`
  min-width: 0;
  text-align: left;
  line-height: 1.2;

  @media (max-width: 760px) {
    display: none;
  }
`;

const UserName = styled.div`
  font-size: ${FONT_SIZES.userName};
  font-weight: 500;
`;

const UserRole = styled.div`
  margin-top: 3px;
  color: hsl(218 10% 48%);
  font-size: ${FONT_SIZES.userRole};
`;

const ChevronIcon = styled.div`
  margin-left: auto;
  color: hsl(218 10% 48%);
  transform: rotate(${(p) => (p.isOpen ? "180deg" : "0deg")});
  transition: transform 160ms ease;
`;

const Menu = styled.div`
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 10;
  width: 174px;
  padding: 6px;
  border: 1px solid hsl(220 13% 90%);
  border-radius: 8px;
  background: hsl(0 0% 100%);
  box-shadow: 0 12px 28px hsl(220 24% 20% / 0.14);
`;

const MenuItem = styled.button`
  width: 100%;
  height: 36px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: ${COLORS.gray10};
  font-size: ${FONT_SIZES.menuItem};
  text-align: left;
  padding: 0 10px;

  &:hover {
    cursor: pointer;
    background: hsl(220 16% 96%);
  }
`;

export default Header;
