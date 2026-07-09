import { createGlobalStyle } from "styled-components";

const GlobalStyles = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    padding: 0;
    margin: 0;
    font-family: var(--font-text);
    
  }

  html {
    height: 100%;
    /* 字体选择 */
    --font-text: 'Space Grotesk', 'Noto Sans SC', sans-serif;     /* 正文 */
    --font-data: 'JetBrains Mono', 'Noto Sans SC', monospace;     /* 数据/坐标/代码 */
  }

  body {
    height: 100%;
  }
`;

export default GlobalStyles;
