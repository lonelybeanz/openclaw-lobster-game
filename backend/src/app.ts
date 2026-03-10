import { Hono } from 'hono';
import { memberService } from './services/member-service';

export const app = new Hono();

app.get('/health', (c) => c.json({ ok: true, message: 'bun+hono member backend running' }));

app.onError((err, c) => {
  return c.json({ code: 500, message: err.message }, 500);
});

app.post('/member/user/create', async (c) => {
  const body = await c.req.json();
  const user = memberService.createUser({ nickname: body.nickname, mobile: body.mobile });
  return c.json({ code: 0, data: user });
});

app.get('/member/user/get', (c) => {
  const id = Number(c.req.query('id'));
  const user = memberService.getUser(id);
  return c.json({ code: 0, data: user });
});

app.put('/member/user/update-level', async (c) => {
  const body = await c.req.json();
  const data = memberService.updateUserLevel({ id: Number(body.id), levelId: Number(body.levelId) });
  return c.json({ code: 0, data });
});

app.get('/member/level/list', (c) => {
  const status = c.req.query('status');
  const levels = memberService.listLevels(status === undefined ? undefined : Number(status));
  return c.json({ code: 0, data: levels });
});

app.get('/member/level/list-all-simple', (c) => {
  const levels = memberService.listLevels(1).map((item) => ({ id: item.id, name: item.name }));
  return c.json({ code: 0, data: levels });
});

app.get('/member/level/get', (c) => {
  const id = Number(c.req.query('id'));
  const level = memberService.getLevel(id);
  return c.json({ code: 0, data: level });
});

app.post('/member/level/create', async (c) => {
  const body = await c.req.json();
  const level = memberService.createLevel({
    name: body.name,
    level: Number(body.level),
    experience: Number(body.experience),
    discountPercent: Number(body.discountPercent),
    icon: body.icon,
    backgroundUrl: body.backgroundUrl,
    status: Number(body.status),
  });
  return c.json({ code: 0, data: level });
});

app.put('/member/level/update', async (c) => {
  const body = await c.req.json();
  const level = memberService.updateLevel({
    id: Number(body.id),
    name: body.name,
    level: Number(body.level),
    experience: Number(body.experience),
    discountPercent: Number(body.discountPercent),
    icon: body.icon,
    backgroundUrl: body.backgroundUrl,
    status: Number(body.status),
  });
  return c.json({ code: 0, data: level });
});

app.delete('/member/level/delete', (c) => {
  const id = Number(c.req.query('id'));
  memberService.deleteLevel(id);
  return c.json({ code: 0, data: true });
});

app.post('/member/experience/add', async (c) => {
  const body = await c.req.json();
  const result = memberService.addExperience({
    userId: Number(body.userId),
    experience: Number(body.experience),
    bizType: Number(body.bizType),
    bizId: String(body.bizId),
  });
  return c.json({ code: 0, data: result });
});

app.post('/member/experience/reduce', async (c) => {
  const body = await c.req.json();
  const result = memberService.addExperience({
    userId: Number(body.userId),
    experience: -Math.abs(Number(body.experience)),
    bizType: Number(body.bizType),
    bizId: String(body.bizId),
  });
  return c.json({ code: 0, data: result });
});

app.get('/member/experience-record/page', (c) => {
  const pageNo = Number(c.req.query('pageNo') ?? '1');
  const pageSize = Number(c.req.query('pageSize') ?? '10');
  const userIdQuery = c.req.query('userId');
  const data = memberService.pageExperienceRecords({
    pageNo,
    pageSize,
    userId: userIdQuery ? Number(userIdQuery) : undefined,
  });
  return c.json({ code: 0, data });
});

app.get('/member/skill/list', (c) => c.json({ code: 0, data: memberService.listSkills() }));

app.post('/member/skill/create', async (c) => {
  const body = await c.req.json();
  const skill = memberService.createSkill({
    code: String(body.code),
    name: String(body.name),
    description: body.description ? String(body.description) : undefined,
    requiredLevel: Number(body.requiredLevel),
    requiredExperience: Number(body.requiredExperience),
    active: body.active === undefined ? 1 : Number(body.active),
  });
  return c.json({ code: 0, data: skill });
});

app.post('/member/skill/learn', async (c) => {
  const body = await c.req.json();
  const data = memberService.learnSkill({
    userId: Number(body.userId),
    skillId: Number(body.skillId),
    source: body.source ? String(body.source) : undefined,
  });
  return c.json({ code: 0, data });
});

app.get('/member/user/skills', (c) => {
  const userId = Number(c.req.query('userId'));
  const data = memberService.getUserSkills(userId);
  return c.json({ code: 0, data });
});

import { getLobsterStats } from './services/lobster';

// 获取龙虾状态
app.get('/lobster/stats', async (c) => {
  const stats = await getLobsterStats();
  return c.json({ code: 0, data: stats });
});
