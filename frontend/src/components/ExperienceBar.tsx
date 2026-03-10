type ExperienceBarProps = {
  currentExperience: number;
  currentLevelExperience: number;
  nextLevelExperience: number | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function ExperienceBar({
  currentExperience,
  currentLevelExperience,
  nextLevelExperience,
}: ExperienceBarProps) {
  const safeCurrent = Math.max(0, currentExperience);
  const safeLevelBase = Math.max(0, currentLevelExperience);

  if (nextLevelExperience === null) {
    return (
      <div>
        <div className="progress-shell" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100}>
          <div className="progress-fill" style={{ width: '100%' }} />
        </div>
        <p>
          进度：<strong>100%</strong>（已满级）
        </p>
      </div>
    );
  }

  const safeNext = Math.max(safeLevelBase + 1, nextLevelExperience);
  const range = safeNext - safeLevelBase;
  const progress = clamp(((safeCurrent - safeLevelBase) / range) * 100, 0, 100);
  const toNext = Math.max(0, safeNext - safeCurrent);

  return (
    <div>
      <div className="progress-shell" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p>
        进度：<strong>{progress.toFixed(1)}%</strong>，还需经验：<strong>{toNext}</strong>
      </p>
    </div>
  );
}
