import { useMemo } from 'react';
import SkillCard from '../components/SkillCard';
import UserCard from '../components/UserCard';
import type { MemberSkill, MemberUser } from '../types';

type UserPageProps = {
  user: MemberUser | null;
  skills: MemberSkill[];
  unlockedSkillIds?: number[] | Set<number>;
  currentLevelExperience?: number;
  nextLevelExperience?: number | null;
  onLearnSkill?: (skillId: number) => void;
  learning?: boolean;
};

export default function UserPage({
  user,
  skills,
  unlockedSkillIds = [],
  currentLevelExperience = 0,
  nextLevelExperience = null,
  onLearnSkill,
  learning = false,
}: UserPageProps) {
  const unlockedSet = useMemo(() => {
    if (unlockedSkillIds instanceof Set) {
      return unlockedSkillIds;
    }
    return new Set(unlockedSkillIds);
  }, [unlockedSkillIds]);

  if (!user) {
    return (
      <div className="page">
        <main className="container">
          <header className="hero">
            <h1>用户主页</h1>
            <p>请先加载用户数据。</p>
          </header>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <main className="container">
        <header className="hero">
          <h1>用户主页</h1>
          <p>查看等级成长、经验进度与技能学习状态。</p>
        </header>

        <section className="grid">
          <UserCard
            nickname={user.nickname}
            levelName={user.levelName ?? '未定级'}
            levelValue={user.levelValue ?? 0}
            experience={user.experience}
            point={user.point}
            currentLevelExperience={currentLevelExperience}
            nextLevelExperience={nextLevelExperience}
          />

          <article className="card">
            <h2>技能卡片</h2>
            <div className="skill-list">
              {skills.map((skill) => {
                const unlocked = unlockedSet.has(skill.id);
                const eligible =
                  (user.levelValue ?? 0) >= skill.required_level &&
                  user.experience >= skill.required_experience &&
                  skill.active === 1;

                return (
                  <SkillCard
                    key={skill.id}
                    id={skill.id}
                    name={skill.name}
                    description={skill.description}
                    requiredLevel={skill.required_level}
                    requiredExperience={skill.required_experience}
                    active={skill.active === 1}
                    unlocked={unlocked}
                    eligible={eligible}
                    onLearn={onLearnSkill}
                    disabled={learning}
                  />
                );
              })}

              {skills.length === 0 && <p>暂无可展示技能</p>}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
