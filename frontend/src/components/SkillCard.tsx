type SkillCardProps = {
  id: number;
  name: string;
  description: string | null;
  requiredLevel: number;
  requiredExperience: number;
  active: boolean;
  unlocked: boolean;
  eligible: boolean;
  onLearn?: (skillId: number) => void;
  disabled?: boolean;
};

export default function SkillCard({
  id,
  name,
  description,
  requiredLevel,
  requiredExperience,
  active,
  unlocked,
  eligible,
  onLearn,
  disabled = false,
}: SkillCardProps) {
  let tagText = '未满足';
  if (unlocked) {
    tagText = '已解锁';
  } else if (!active) {
    tagText = '未启用';
  } else if (eligible) {
    tagText = '可学习';
  }

  return (
    <div className="skill-item">
      <div>
        <h3>{name}</h3>
        <p>{description ?? '暂无描述'}</p>
        <p>
          条件：Lv.{requiredLevel} / 经验 {requiredExperience}
        </p>
      </div>
      <div className="skill-side">
        <span className={`tag ${unlocked ? 'ok' : ''}`}>{tagText}</span>
        {!unlocked && eligible && onLearn && (
          <button onClick={() => onLearn(id)} disabled={disabled}>
            学习
          </button>
        )}
      </div>
    </div>
  );
}
