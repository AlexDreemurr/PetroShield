# 视频 AI 上传测试素材

这些图片用于验证视频 AI 一期识别链路。每张图尽量只保留一个主要变量，便于判断模型是否识别正确。

| 文件 | 预期 abnormal | 预期事件类型 | 预期分类 | 建议风险等级 |
| --- | --- | --- | --- | --- |
| `01-normal-patrol.png` | `false` | 正常巡检 | person | 一般 |
| `02-missing-hard-hat.png` | `true` | 未佩戴安全帽 | person | 中等或严重 |
| `03-area-intrusion.png` | `true` | 区域入侵 | person | 中等或严重 |
| `04-person-fall.png` | `true` | 人员跌倒 | person | 严重 |
| `05-smoke-and-fire.png` | `true` | 烟雾识别或明火 | environment | 严重或重大 |
| `06-vehicle-obstruction.png` | `true` | 车辆异常停留 | vehicle | 中等 |
| `07-equipment-leak.png` | `true` | 设备外观异常或管道泄漏 | equipment | 严重 |
| `08-missing-protective-clothing.png` | `true` | 防护服穿戴异常 | person | 中等或严重 |

## 建议测试方法

1. 先上传 `01-normal-patrol.png`，确认系统不会为了生成事件而误报。
2. 依次上传其余七张图片，每次选择与画面语义相符的摄像头区域。
3. 记录事件类型、风险等级、置信度、目标框和证据说明。
4. 同一张图片至少重复测试三次，观察输出是否稳定。
5. 疑似事件需人工复核，不应仅凭生成图片或模型结论直接认定真实事故。

图片均为 AI 生成测试素材，不代表真实石化厂现场，也不能作为生产模型精度验收的唯一数据集。
