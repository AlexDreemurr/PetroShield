import { useEffect } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import styled from "styled-components";

function MapFullscreenButton({ isFullscreen, onChange }) {

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onChange(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onChange]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (isFullscreen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  const Icon = isFullscreen ? Minimize2 : Maximize2;
  const label = isFullscreen ? "退出全屏" : "地图全屏";
  return (
    <FullscreenButton type="button" title={label} aria-label={label} onClick={() => onChange(!isFullscreen)}>
      <Icon size={16} />
    </FullscreenButton>
  );
}

const FullscreenButton = styled.button`
  position: absolute;
  left: 12px;
  top: 12px;
  z-index: 10;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid hsl(220 13% 80%);
  border-radius: 5px;
  color: hsl(218 18% 25%);
  background: hsl(0 0% 100% / 0.94);
  box-shadow: 0 4px 12px hsl(218 30% 12% / 0.2);
  cursor: pointer;

  &:hover { color: hsl(214 92% 48%); border-color: hsl(214 70% 68%); }
`;

export default MapFullscreenButton;
