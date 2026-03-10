import ExperienceBar from './ExperienceBar';

type UserCardProps = {
  nickname: string;
  levelName: string;
  levelValue: number;
  experience: number;
  point: number;
  currentLevelExperience: number;
  nextLevelExperience: number | null;
};

export default function UserCard({
  nickname,
  levelName,
  levelValue,
  experience,
  point,
  currentLevelExperience,
  nextLevelExperience,
}: UserCardProps) {
  return (
    <article className="card">
      <h2>用户卡片</h2>
      <p>
        昵称：<strong>{nickname}</strong>
      </p>
      <p>
        等级：<strong>{levelName}</strong>（Lv.{levelValue}）
      </p>
      <p>
        经验值：<strong>{experience}</strong>
      </p>
      <p>
        积分：<strong>{point}</strong>
      </p>
      <ExperienceBar
        currentExperience={experience}
        currentLevelExperience={currentLevelExperience}
        nextLevelExperience={nextLevelExperience}
      />
    </article>
  );
}
