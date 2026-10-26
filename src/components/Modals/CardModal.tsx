import React, { useState, useEffect } from 'react';
import type { Card } from '../../types/game.ts';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Check,
  Stethoscope,
} from 'lucide-react';
import './CardModal.css';

interface CardModalProps {
  card: Card | null;
  isOpen: boolean;
  onConfirm: () => void;
}

const CATEGORY_META = {
  income: {
    label: 'Bevétel',
    icon: TrendingUp,
    badgeClass: 'income',
    frontClass: 'category-income',
  },
  expense: {
    label: 'Kiadás',
    icon: TrendingDown,
    badgeClass: 'expense',
    frontClass: 'category-expense',
  },
  advantage: {
    label: 'Előny',
    icon: Sparkles,
    badgeClass: 'advantage',
    frontClass: 'category-advantage',
  },
  disadvantage: {
    label: 'Hátrány',
    icon: AlertTriangle,
    badgeClass: 'disadvantage',
    frontClass: 'category-disadvantage',
  },
};

export const CardModal: React.FC<CardModalProps> = ({ card, isOpen, onConfirm }) => {
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // Kártya megnyitásakor automatikus megfordítás 300ms késleltetéssel
  useEffect(() => {
    if (!isOpen || !card) return;
    const timer = setTimeout(() => {
      setIsFlipped(true);
    }, 400);
    return () => {
      clearTimeout(timer);
      setIsFlipped(false);
    };
  }, [isOpen, card]);

  if (!isOpen || !card) {
    return null;
  }

  const meta = CATEGORY_META[card.category] || CATEGORY_META.advantage;
  const CategoryIcon = meta.icon;

  return (
    <div className="card-modal-backdrop" onClick={() => !isFlipped && setIsFlipped(true)}>
      <div className="card-modal-container" onClick={(e) => e.stopPropagation()}>
        <div
          className="card-flipper-scene"
          onClick={() => setIsFlipped((prev) => !prev)}
          title="Kattints a megfordításhoz!"
        >
          <div className={`card-flipper-inner ${isFlipped ? 'flipped' : ''}`}>
            {/* HÁTLAP */}
            <div className="card-face card-face-back">
              <div className="card-back-pattern" />
              <div className="card-back-emblem">
                <Stethoscope className="w-10 h-10 text-sky-400" />
              </div>
              <h3 className="card-back-logo-text">CODEBLUE</h3>
              <p className="card-back-subtext">Klinikai Eseménykártya</p>
              <div className="card-back-hint">
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Kattints a megfordításhoz...</span>
              </div>
            </div>

            {/* ELŐLAP */}
            <div className={`card-face card-face-front ${meta.frontClass}`}>
              <div className="card-front-header">
                <span className={`card-category-pill ${meta.badgeClass}`}>
                  <CategoryIcon className="w-3.5 h-3.5" />
                  {meta.label}
                </span>
                <span className="card-number">#{card.id} / 40</span>
              </div>

              <div className="card-front-body">
                <h2 className="card-front-title">{card.title}</h2>

                <div className="card-front-desc-box">
                  <p className="card-front-instruction">{card.description}</p>
                </div>

                {card.flavorText && (
                  <p className="card-front-flavor">„{card.flavorText}”</p>
                )}
              </div>

              <div className="card-front-footer">
                <button
                  type="button"
                  className="btn-card-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfirm();
                  }}
                >
                  <Check className="w-4 h-4" />
                  <span>Végrehajtás & Folytatás</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CardModal;
