import { Database } from 'bun:sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件目录
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'member.sqlite');

const db = new Database(dbPath, { create: true });
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS member_level (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  level INTEGER NOT NULL UNIQUE,
  experience INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 100,
  icon TEXT,
  background_url TEXT,
  status INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS member_user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mobile TEXT,
  nickname TEXT NOT NULL,
  level_id INTEGER,
  experience INTEGER NOT NULL DEFAULT 0,
  point INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(level_id) REFERENCES member_level(id)
);

CREATE TABLE IF NOT EXISTS member_experience_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  biz_type INTEGER NOT NULL,
  biz_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  experience INTEGER NOT NULL,
  total_experience INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES member_user(id)
);

CREATE TABLE IF NOT EXISTS member_level_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  level_id INTEGER NOT NULL,
  level INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL,
  experience INTEGER NOT NULL,
  user_experience INTEGER NOT NULL,
  remark TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES member_user(id),
  FOREIGN KEY(level_id) REFERENCES member_level(id)
);

CREATE TABLE IF NOT EXISTS member_skill (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  required_level INTEGER NOT NULL DEFAULT 1,
  required_experience INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS member_user_skill (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill_id INTEGER NOT NULL,
  unlock_source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, skill_id),
  FOREIGN KEY(user_id) REFERENCES member_user(id),
  FOREIGN KEY(skill_id) REFERENCES member_skill(id)
);
`);

const levelCount = db.query('SELECT COUNT(1) AS c FROM member_level').get() as { c: number };
if (!levelCount.c) {
  const insertLevel = db.query(
    'INSERT INTO member_level (name, level, experience, discount_percent, status) VALUES (?, ?, ?, ?, 1)',
  );
  insertLevel.run('青铜会员', 1, 0, 100);
  insertLevel.run('白银会员', 2, 100, 98);
  insertLevel.run('黄金会员', 3, 300, 95);
  insertLevel.run('钻石会员', 4, 600, 90);
}

const skillCount = db.query('SELECT COUNT(1) AS c FROM member_skill').get() as { c: number };
if (!skillCount.c) {
  const insertSkill = db.query(
    'INSERT INTO member_skill (code, name, description, required_level, required_experience, active) VALUES (?, ?, ?, ?, ?, 1)',
  );
  insertSkill.run('FIRST_SIGN', '签到达人', '获得签到额外奖励', 1, 50);
  insertSkill.run('ORDER_MASTER', '下单能手', '下单经验加成', 2, 150);
  insertSkill.run('INVITE_PRO', '邀请专家', '邀新奖励加成', 3, 350);
}

export { db };
