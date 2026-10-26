import React, { useState } from 'react';
import { Dices } from 'lucide-react';
import './DiceRoller.css';

interface DiceRollerProps {
  onRoll: (result: number) => void;
  isRolling: boolean;
  diceResult: number | null;
  disabled?: boolean;
  buttonLabel?: string;
}

export const DiceRoller: React.FC<DiceRollerProps> = ({
  onRoll,
  isRolling,
  diceResult,
  disabled = false,
  buttonLabel = 'Kockadobás',
}) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  // Map 1-6 to 3D cube face rotations
  const getFaceRotation = (val: number) => {
    switch (val) {
      case 1:
        return { x: 0, y: 0 };
      case 6:
        return { x: 180, y: 0 };
      case 2:
        return { x: 0, y: -90 };
      case 5:
        return { x: 0, y: 90 };
      case 3:
        return { x: -90, y: 0 };
      case 4:
        return { x: 90, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  };

  const handleRollClick = () => {
    if (disabled || isRolling) return;

    // Generate random 1 to 6
    const randomValue = Math.floor(Math.random() * 6) + 1;

    // Add extra spin turns (e.g. 720 or 1080 deg)
    const baseRotation = getFaceRotation(randomValue);
    const spins = 3;
    setRotation({
      x: baseRotation.x + 360 * spins,
      y: baseRotation.y + 360 * spins,
    });

    onRoll(randomValue);
  };

  const currentFace = diceResult || 1;
  const currentRotation = isRolling ? rotation : getFaceRotation(currentFace);

  return (
    <div className="dice-roller-container">
      {/* 3D Dice Stage */}
      <div className="dice-scene" onClick={handleRollClick}>
        <div
          className={`dice-cube ${isRolling ? 'cube-tumbling' : ''}`}
          style={{
            transform: `rotateX(${currentRotation.x}deg) rotateY(${currentRotation.y}deg)`,
          }}
        >
          {/* Face 1 */}
          <div className="dice-face face-front">
            <span className="dot dot-center" />
          </div>

          {/* Face 6 */}
          <div className="dice-face face-back">
            <span className="dot dot-top-left" />
            <span className="dot dot-top-right" />
            <span className="dot dot-mid-left" />
            <span className="dot dot-mid-right" />
            <span className="dot dot-bot-left" />
            <span className="dot dot-bot-right" />
          </div>

          {/* Face 2 */}
          <div className="dice-face face-right">
            <span className="dot dot-top-left" />
            <span className="dot dot-bot-right" />
          </div>

          {/* Face 5 */}
          <div className="dice-face face-left">
            <span className="dot dot-top-left" />
            <span className="dot dot-top-right" />
            <span className="dot dot-center" />
            <span className="dot dot-bot-left" />
            <span className="dot dot-bot-right" />
          </div>

          {/* Face 3 */}
          <div className="dice-face face-top">
            <span className="dot dot-top-left" />
            <span className="dot dot-center" />
            <span className="dot dot-bot-right" />
          </div>

          {/* Face 4 */}
          <div className="dice-face face-bottom">
            <span className="dot dot-top-left" />
            <span className="dot dot-top-right" />
            <span className="dot dot-bot-left" />
            <span className="dot dot-bot-right" />
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
        className="dice-roll-button"
        onClick={handleRollClick}
        disabled={disabled || isRolling}
      >
        <Dices size={20} className={isRolling ? 'dice-icon-spin' : ''} />
        <span>{isRolling ? 'Dobás folyamatban...' : buttonLabel}</span>
      </button>

      {/* Result feedback */}
      {diceResult !== null && !isRolling && (
        <div className="dice-result-badge">
          Dobott érték: <strong>{diceResult}</strong>
        </div>
      )}
    </div>
  );
};
