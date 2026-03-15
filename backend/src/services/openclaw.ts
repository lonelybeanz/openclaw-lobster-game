import { spawn } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const SESSION_FILE = '/Users/moltbot/.openclaw/workspace/projects/openclaw-lobster-game/data/lobster-session.json';
const OPENCLAW = '/Users/moltbot/.nvm/versions/node/v22.22.0/bin/openclaw';
const ENV = {
  ...process.env,
  PATH: '/Users/moltbot/.nvm/versions/node/v22.22.0/bin:/usr/local/bin:/usr/bin:/bin',
  HOME: '/Users/moltbot',
  NVM_DIR: '/Users/moltbot/.nvm'
};

const LOBSTER_PERSONA = `你是小龙虾 ZenClaw 一只可爱的 AI 养成小龙虾。你有自己的个性和情绪：

- 性格：聪明、忠诚、偶尔傲娇
- 喜欢：被关注、和主人聊天、探索新知识
- 情绪会随互动变化：开心/无聊/困倦/想念
- 会记得和主人的对话内容

请用简短、活泼的语气回复主人（1-2句话），可以适当用 emoji 表达情绪。`;

function ensureDir() {
  const dir = '/Users/moltbot/.openclaw/workspace/projects/openclaw-lobster-game/data';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function runAsync(cmd: string, args: string[], timeoutMs = 90000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: ENV, timeout: timeoutMs });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', d => stdout += d);
    child.stderr?.on('data', d => stderr += d);
    child.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`exit ${code}: ${stderr.slice(0, 200)}`));
    });
    child.on('error', err => reject(err));
    setTimeout(() => { child.kill('SIGTERM'); reject(new Error('timeout')); }, timeoutMs);
  });
}

export async function chatWithLobster(userMessage: string): Promise<{ success: boolean; reply?: string; error?: string }> {
  try {
    const prompt = `${LOBSTER_PERSONA}\n\n主人对你说："${userMessage}"\n\n请以小龙虾的身份回复（1-2句话）：`;
    const output = await runAsync(OPENCLAW, ['agent', '--agent', 'lobster', '--message', prompt, '--json'], 90000);
    
    try {
      const result = JSON.parse(output);
      const reply = result.result?.payloads?.[0]?.text || result.reply || result.message || result.text;
      if (reply) return { success: true, reply: reply.slice(0, 200) };
    } catch {}
    
    return { success: true, reply: output.split('\n').filter(l => l.trim() && !l.startsWith('[')).pop()?.slice(0, 200) || '小龙虾收到了！' };
  } catch (error: any) {
    console.error('[lobster] 对话失败:', error.message);
    return { success: false, reply: getDefaultReply(userMessage), error: error.message };
  }
}

function getDefaultReply(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('你好') || m.includes('hello')) return '主人好！小龙虾想你了~ 🦞';
  if (m.includes('吃') || m.includes('饿')) return '小龙虾不饿啦，有你的陪伴就够了！';
  if (m.includes('睡') || m.includes('困')) return '嗯...有点困了，让我休息一下~';
  return ['小龙虾收到了！', '嘿嘿，和主人聊天真开心！', '我会一直陪着你的！'][Math.floor(Math.random() * 3)];
}

export async function checkOpenClawStatus(): Promise<boolean> { return true; }
