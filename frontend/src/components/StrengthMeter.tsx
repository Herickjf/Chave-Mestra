import { passwordScore } from '../utils/passwordStrength';
export function StrengthMeter({ value }: { value: string }) {
  const score = passwordScore(value);
  return (
    <div className="strength">
      <div className="strength-track">
        <span className={`strength-${value ? score + 1 : 0}`} />
      </div>
      <small>
        {value
          ? ['Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Muito forte'][score]
          : 'Use ao menos 12 caracteres e uma senha forte'}
      </small>
    </div>
  );
}
