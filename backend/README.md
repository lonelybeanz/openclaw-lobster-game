# Bun + Hono 会员后端（经验/等级/技能）

## 启动

```bash
bun install
bun run --watch index.ts
```

服务默认监听 `3000`。

## 核心业务逻辑

- 经验计算
  - 支持按业务类型增减经验（管理员调整、邀新、签到、抽奖、下单、退款等）
  - 经验下限为 `0`
  - 每次变更写入 `member_experience_record`
- 等级系统
  - 按经验阈值自动匹配已启用等级中的最高可达等级
  - 等级变化写入 `member_level_record`
  - 支持后台手动调整用户等级（若目标等级经验更高，会同步提升用户经验）
- 技能系统
  - 技能具备 `required_level + required_experience` 解锁条件
  - 用户经验/等级变化后自动解锁符合条件的技能（`member_user_skill`）
  - 支持手动学习技能（同样校验等级与经验）

## 主要接口

- `POST /member/user/create`
- `GET /member/user/get?id=1`
- `PUT /member/user/update-level`
- `GET /member/level/list`
- `POST /member/level/create`
- `PUT /member/level/update`
- `DELETE /member/level/delete?id=1`
- `POST /member/experience/add`
- `POST /member/experience/reduce`
- `GET /member/experience-record/page?pageNo=1&pageSize=10&userId=1`
- `GET /member/skill/list`
- `POST /member/skill/create`
- `POST /member/skill/learn`
- `GET /member/user/skills?userId=1`

## 说明

当前工作区未包含原 Java 源码，仅包含索引摘要；本实现基于可见索引语义进行 Bun + Hono 等价迁移，重点保留经验计算、等级重算、技能解锁三段业务流程。
