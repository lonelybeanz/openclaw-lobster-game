import { db } from '../db';
import { getBizType, type MemberLevel, type MemberUser } from '../types';

function toLevel(row: any): MemberLevel {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    experience: row.experience,
    discountPercent: row.discount_percent,
    icon: row.icon,
    backgroundUrl: row.background_url,
    status: row.status,
  };
}

function toUser(row: any): MemberUser {
  return {
    id: row.id,
    mobile: row.mobile,
    nickname: row.nickname,
    levelId: row.level_id,
    experience: row.experience,
    point: row.point,
  };
}

function formatDescription(template: string, value: number): string {
  return template.replace('{}', String(Math.abs(value)));
}

function getUserOrThrow(userId: number): MemberUser {
  const row = db.query('SELECT * FROM member_user WHERE id = ?').get(userId);
  if (!row) throw new Error(`用户不存在: ${userId}`);
  return toUser(row);
}

function getLevelOrThrow(levelId: number): MemberLevel {
  const row = db.query('SELECT * FROM member_level WHERE id = ?').get(levelId);
  if (!row) throw new Error(`等级不存在: ${levelId}`);
  return toLevel(row);
}

function getBestLevelByExperience(experience: number): MemberLevel | null {
  const row = db
    .query(
      `SELECT * FROM member_level
       WHERE status = 1 AND experience <= ?
       ORDER BY level DESC
       LIMIT 1`,
    )
    .get(experience);
  return row ? toLevel(row) : null;
}

function upsertUserLevel(userId: number, nextLevel: MemberLevel, userExperience: number, remark: string, description: string) {
  db.query('UPDATE member_user SET level_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextLevel.id, userId);
  db.query(
    `INSERT INTO member_level_record
      (user_id, level_id, level, discount_percent, experience, user_experience, remark, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    nextLevel.id,
    nextLevel.level,
    nextLevel.discountPercent,
    nextLevel.experience,
    userExperience,
    remark,
    description,
  );
}

function unlockSkills(userId: number): number {
  const userRow = db
    .query(
      `SELECT u.id, u.experience, l.level
       FROM member_user u
       LEFT JOIN member_level l ON l.id = u.level_id
       WHERE u.id = ?`,
    )
    .get(userId) as { id: number; experience: number; level: number | null } | null;

  if (!userRow) throw new Error(`用户不存在: ${userId}`);

  const userLevel = userRow.level ?? 0;
  const skills = db
    .query(
      `SELECT s.id FROM member_skill s
       WHERE s.active = 1
         AND s.required_level <= ?
         AND s.required_experience <= ?
         AND NOT EXISTS (
          SELECT 1 FROM member_user_skill us
          WHERE us.user_id = ? AND us.skill_id = s.id
         )`,
    )
    .all(userLevel, userRow.experience, userId) as { id: number }[];

  const insert = db.query('INSERT INTO member_user_skill (user_id, skill_id, unlock_source) VALUES (?, ?, ?)');
  for (const skill of skills) {
    insert.run(userId, skill.id, 'auto');
  }
  return skills.length;
}

export const memberService = {
  createUser(payload: { nickname: string; mobile?: string }) {
    const level = getBestLevelByExperience(0);
    const result = db
      .query('INSERT INTO member_user (mobile, nickname, level_id, experience, point) VALUES (?, ?, ?, 0, 0)')
      .run(payload.mobile ?? null, payload.nickname, level?.id ?? null);
    const id = Number(result.lastInsertRowid);
    unlockSkills(id);
    return this.getUser(id);
  },

  getUser(id: number) {
    const row = db
      .query(
        `SELECT u.*, l.name AS level_name, l.level AS level_value
         FROM member_user u
         LEFT JOIN member_level l ON l.id = u.level_id
         WHERE u.id = ?`,
      )
      .get(id) as any;
    if (!row) return null;
    return {
      ...toUser(row),
      levelName: row.level_name ?? null,
      levelValue: row.level_value ?? null,
    };
  },

  listLevels(status?: number) {
    const rows = status === undefined
      ? db.query('SELECT * FROM member_level ORDER BY level ASC').all()
      : db.query('SELECT * FROM member_level WHERE status = ? ORDER BY level ASC').all(status);
    return (rows as any[]).map(toLevel);
  },

  getLevel(id: number) {
    const row = db.query('SELECT * FROM member_level WHERE id = ?').get(id);
    return row ? toLevel(row) : null;
  },

  createLevel(payload: {
    name: string;
    level: number;
    experience: number;
    discountPercent: number;
    icon?: string;
    backgroundUrl?: string;
    status: number;
  }) {
    db.query(
      `INSERT INTO member_level
      (name, level, experience, discount_percent, icon, background_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      payload.name,
      payload.level,
      payload.experience,
      payload.discountPercent,
      payload.icon ?? null,
      payload.backgroundUrl ?? null,
      payload.status,
    );
    return this.listLevels().find((it) => it.level === payload.level) ?? null;
  },

  updateLevel(payload: {
    id: number;
    name: string;
    level: number;
    experience: number;
    discountPercent: number;
    icon?: string;
    backgroundUrl?: string;
    status: number;
  }) {
    getLevelOrThrow(payload.id);
    db.query(
      `UPDATE member_level SET
       name = ?, level = ?, experience = ?, discount_percent = ?, icon = ?, background_url = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(
      payload.name,
      payload.level,
      payload.experience,
      payload.discountPercent,
      payload.icon ?? null,
      payload.backgroundUrl ?? null,
      payload.status,
      payload.id,
    );
    return this.getLevel(payload.id);
  },

  deleteLevel(id: number) {
    getLevelOrThrow(id);
    db.query('DELETE FROM member_level WHERE id = ?').run(id);
    return true;
  },

  updateUserLevel(payload: { id: number; levelId: number }) {
    const user = getUserOrThrow(payload.id);
    const level = getLevelOrThrow(payload.levelId);
    const nextExperience = Math.max(user.experience, level.experience);

    db.query('UPDATE member_user SET level_id = ?, experience = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      level.id,
      nextExperience,
      payload.id,
    );

    db.query(
      `INSERT INTO member_level_record
      (user_id, level_id, level, discount_percent, experience, user_experience, remark, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      payload.id,
      level.id,
      level.level,
      level.discountPercent,
      level.experience,
      nextExperience,
      '管理员调整',
      `管理员调整会员等级为 ${level.name}`,
    );

    const unlocked = unlockSkills(payload.id);
    return { user: this.getUser(payload.id), unlocked };
  },

  addExperience(payload: { userId: number; experience: number; bizType: number; bizId: string }) {
    const bizType = getBizType(payload.bizType);
    if (!bizType) throw new Error(`不支持的经验业务类型: ${payload.bizType}`);

    const user = getUserOrThrow(payload.userId);
    const delta = payload.experience;
    if (!delta) throw new Error('经验变更值不能为 0');

    const totalExperience = Math.max(0, user.experience + delta);
    db.query('UPDATE member_user SET experience = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(totalExperience, payload.userId);

    db.query(
      `INSERT INTO member_experience_record
      (user_id, biz_type, biz_id, title, description, experience, total_experience)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      payload.userId,
      bizType.type,
      payload.bizId,
      bizType.title,
      formatDescription(bizType.description, delta),
      delta,
      totalExperience,
    );

    const bestLevel = getBestLevelByExperience(totalExperience);
    const oldLevelId = user.levelId;
    let leveled = false;
    if (bestLevel && oldLevelId !== bestLevel.id) {
      upsertUserLevel(payload.userId, bestLevel, totalExperience, '经验变更自动重算', `经验达到 ${totalExperience}，自动更新为 ${bestLevel.name}`);
      leveled = true;
    }

    const unlocked = unlockSkills(payload.userId);
    return { user: this.getUser(payload.userId), leveled, unlocked };
  },

  pageExperienceRecords(params: { pageNo: number; pageSize: number; userId?: number }) {
    const pageNo = Math.max(1, params.pageNo);
    const pageSize = Math.max(1, Math.min(100, params.pageSize));
    const offset = (pageNo - 1) * pageSize;

    const where = params.userId ? 'WHERE user_id = ?' : '';
    const totalRow = params.userId
      ? (db.query(`SELECT COUNT(1) AS c FROM member_experience_record ${where}`).get(params.userId) as { c: number })
      : (db.query('SELECT COUNT(1) AS c FROM member_experience_record').get() as { c: number });

    const list = params.userId
      ? db.query(
          `SELECT * FROM member_experience_record ${where}
           ORDER BY id DESC LIMIT ? OFFSET ?`,
        ).all(params.userId, pageSize, offset)
      : db.query('SELECT * FROM member_experience_record ORDER BY id DESC LIMIT ? OFFSET ?').all(pageSize, offset);

    return {
      total: totalRow.c,
      list,
      pageNo,
      pageSize,
    };
  },

  listSkills() {
    return db.query('SELECT * FROM member_skill ORDER BY id ASC').all();
  },

  createSkill(payload: {
    code: string;
    name: string;
    description?: string;
    requiredLevel: number;
    requiredExperience: number;
    active?: number;
  }) {
    db.query(
      `INSERT INTO member_skill
      (code, name, description, required_level, required_experience, active)
      VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      payload.code,
      payload.name,
      payload.description ?? null,
      payload.requiredLevel,
      payload.requiredExperience,
      payload.active ?? 1,
    );
    return db.query('SELECT * FROM member_skill WHERE code = ?').get(payload.code);
  },

  learnSkill(payload: { userId: number; skillId: number; source?: string }) {
    const user = this.getUser(payload.userId);
    if (!user) throw new Error(`用户不存在: ${payload.userId}`);

    const skill = db.query('SELECT * FROM member_skill WHERE id = ?').get(payload.skillId) as any;
    if (!skill) throw new Error(`技能不存在: ${payload.skillId}`);

    if (!skill.active) throw new Error('技能未启用');
    if ((user.levelValue ?? 0) < skill.required_level) {
      throw new Error(`等级不足，要求等级 ${skill.required_level}`);
    }
    if (user.experience < skill.required_experience) {
      throw new Error(`经验不足，要求经验 ${skill.required_experience}`);
    }

    db.query('INSERT OR IGNORE INTO member_user_skill (user_id, skill_id, unlock_source) VALUES (?, ?, ?)').run(
      payload.userId,
      payload.skillId,
      payload.source ?? 'manual',
    );

    return this.getUserSkills(payload.userId);
  },

  getUserSkills(userId: number) {
    getUserOrThrow(userId);
    return db
      .query(
        `SELECT s.*, us.unlock_source, us.created_at AS unlocked_at
         FROM member_user_skill us
         INNER JOIN member_skill s ON s.id = us.skill_id
         WHERE us.user_id = ?
         ORDER BY us.id ASC`,
      )
      .all(userId);
  },
};
