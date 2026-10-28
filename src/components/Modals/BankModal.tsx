import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Landmark, PiggyBank, TrendingUp, Wallet, X } from 'lucide-react';
import type { BankProduct, Player } from '../../types/game.ts';
import { GAME_CONSTANTS } from '../../types/game.ts';
import { getBankBalances } from '../../utils/bank.ts';
import './BankModal.css';

interface BankModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  canTransact: boolean;
  onTakeLoan: (amount: number) => void;
  onRepayLoan: (amount: number) => void;
  onDeposit: (product: BankProduct, amount: number) => void;
  onWithdraw: (product: BankProduct, amount: number) => void;
}

const formatAmount = (amount: number) => `${amount.toLocaleString('hu-HU')} KK`;
const tabs = [
  { id: 'loans', label: 'Hitelkezelés', icon: Landmark },
  { id: 'savings', label: 'Megtakarítás', icon: PiggyBank },
  { id: 'investments', label: 'Befektetések', icon: TrendingUp },
] as const;
type BankTab = typeof tabs[number]['id'];

interface ProductCardProps {
  product: BankProduct;
  title: string;
  rate: string;
  description: string;
  balance: number;
  cash: number;
  canTransact: boolean;
  onDeposit: BankModalProps['onDeposit'];
  onWithdraw: BankModalProps['onWithdraw'];
}

function ProductCard({ product, title, rate, description, balance, cash, canTransact, onDeposit, onWithdraw }: ProductCardProps) {
  const [amount, setAmount] = useState('100000');
  const value = /^\d+$/.test(amount) ? Number(amount) : 0;
  const validAmount = Number.isSafeInteger(value) && value > 0;

  return (
    <section className={`bank-product bank-product-${product}`}>
      <div className="bank-product-heading">
        <h3>{title}</h3>
        <span className="bank-rate">{rate}</span>
      </div>
      <p className="bank-product-rule">{description}</p>
      <div className="bank-product-balance" aria-live="polite">
        <span>Aktuális egyenleg</span>
        <strong>{formatAmount(balance)}</strong>
      </div>
      <label className="bank-amount-label" htmlFor={`bank-amount-${product}`}>Összeg (KK)</label>
      <div className="bank-amount-row">
        <input id={`bank-amount-${product}`} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={amount}
          onChange={(event) => setAmount(event.target.value)} aria-invalid={amount !== '' && !validAmount} disabled={!canTransact} />
        {[100_000, 200_000].map((preset) => (
          <button key={preset} type="button" className="bank-preset" disabled={!canTransact} onClick={() => setAmount(String(preset))}>{preset / 1000} ezer</button>
        ))}
      </div>
      <div className="bank-product-actions">
        <button type="button" className="bank-button bank-button-primary" disabled={!canTransact || !validAmount || value > cash} onClick={() => onDeposit(product, value)}>
          <ArrowUpRight size={16} /> {product === 'savings' ? 'Befizetés' : 'Vásárlás'}
        </button>
        <button type="button" className="bank-button bank-button-secondary" disabled={!canTransact || !validAmount || value > balance} onClick={() => onWithdraw(product, value)}>
          <ArrowDownLeft size={16} /> {product === 'savings' ? 'Kivét' : 'Visszaváltás'}
        </button>
      </div>
      <button type="button" className="bank-withdraw-all" disabled={!canTransact || balance <= 0} onClick={() => onWithdraw(product, balance)}>Teljes egyenleg kivétele</button>
    </section>
  );
}

function BankDialog({ onClose, player, canTransact, onTakeLoan, onRepayLoan, onDeposit, onWithdraw }: Omit<BankModalProps, 'isOpen' | 'player'> & { player: Player }) {
  const [tab, setTab] = useState<BankTab>('loans');
  const dialogRef = useRef<HTMLDivElement>(null);
  const balances = getBankBalances(player);
  const unit = GAME_CONSTANTS.LOAN_UNIT;
  const partialRepayment = Math.min(unit, player.debt);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="bank-modal-backdrop" onClick={onClose}>
      <div className="bank-modal-card" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="bank-title" tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
          if (event.key !== 'Tab') return;
          const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]');
          if (!focusable?.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <header className="bank-header">
          <img src="/assets/bank_hq.jpg" alt="" className="bank-hero" />
          <div className="bank-header-copy">
            <span className="bank-eyebrow"><Landmark size={15} /> CODEBLUE BANK</span>
            <h2 id="bank-title">Klinikai Magánbank</h2>
            <p>{player.name} pénzügyei</p>
          </div>
          <button type="button" className="btn-bank-close" onClick={onClose} aria-label="Bank bezárása"><X size={20} /></button>
        </header>
        <div className="bank-body">
          <div className="bank-summary-grid" aria-live="polite">
            <div className="bank-summary cash"><span><Wallet size={14} /> Készpénz</span><strong>{formatAmount(player.cash)}</strong></div>
            <div className="bank-summary debt"><span><AlertCircle size={14} /> Tartozás</span><strong>{formatAmount(player.debt)}</strong></div>
            <div className="bank-summary"><span><PiggyBank size={14} /> Megtakarítás</span><strong>{formatAmount(balances.savings)}</strong></div>
            <div className="bank-summary"><span><TrendingUp size={14} /> Befektetések</span><strong>{formatAmount(balances.clinicalBond + balances.biotechEquity)}</strong></div>
          </div>
          <div className="bank-tabs" role="tablist" aria-label="Banki szolgáltatások">
            {tabs.map(({ id, label, icon: Icon }, index) => (
              <button key={id} id={`bank-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`bank-panel-${id}`} tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(event) => {
                  const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                  if (!offset && event.key !== 'Home' && event.key !== 'End') return;
                  event.preventDefault();
                  const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : tabs[(index + offset + tabs.length) % tabs.length];
                  setTab(next.id);
                  document.getElementById(`bank-tab-${next.id}`)?.focus();
                }}><Icon size={17} /><span>{label}</span></button>
            ))}
          </div>
          {!canTransact && <p className="bank-notice">Banki műveletek a saját körödben, dobás előtt vagy építkezéskor érhetők el.</p>}
          <div id={`bank-panel-${tab}`} role="tabpanel" aria-labelledby={`bank-tab-${tab}`} tabIndex={0}>
            {tab === 'loans' && (
              <div className="bank-loan-grid">
                <section className="bank-product">
                  <h3>Hitelfelvétel</h3>
                  <p className="bank-product-rule">{formatAmount(unit)} egységekben, azonnali jóváírással.</p>
                  <div className="bank-loan-amounts">
                    {[unit, unit * 2, 1_000_000].map((amount) => <button key={amount} type="button" className="bank-button bank-button-primary" disabled={!canTransact} onClick={() => onTakeLoan(amount)}>+{formatAmount(amount)}</button>)}
                  </div>
                </section>
                <section className="bank-product">
                  <h3>Hiteltörlesztés</h3>
                  <p className="bank-product-rule">A győzelemhez minden tartozást vissza kell fizetned.</p>
                  {player.debt > 0 ? <div className="bank-loan-amounts">
                    <button type="button" className="bank-button bank-button-secondary" disabled={!canTransact || player.cash < partialRepayment} onClick={() => onRepayLoan(partialRepayment)}>Törlesztés: {formatAmount(partialRepayment)}</button>
                    <button type="button" className="bank-button bank-button-secondary" disabled={!canTransact || player.cash < player.debt} onClick={() => onRepayLoan(player.debt)}>Teljes törlesztés</button>
                  </div> : <p className="bank-debt-free">Nincs fennálló tartozásod.</p>}
                </section>
              </div>
            )}
            {tab === 'savings' && <ProductCard product="savings" title="Megtakarítási betét" rate="+5% / START" description="Minden előre START-áthaladáskor 5% kamat kerül a betétedhez. Bármikor kiveheted a saját körödben." balance={balances.savings} cash={player.cash} canTransact={canTransact} onDeposit={onDeposit} onWithdraw={onWithdraw} />}
            {tab === 'investments' && <div className="bank-investment-grid">
              <ProductCard product="clinicalBond" title="Klinikai Kötvény" rate="+10% / START" description="Minden előre START-áthaladáskor 10% hozam kerül a kötvény egyenlegéhez." balance={balances.clinicalBond} cash={player.cash} canTransact={canTransact} onDeposit={onDeposit} onWithdraw={onWithdraw} />
              <ProductCard product="biotechEquity" title="Biotech Részvény" rate="−10%…+20%" description="START-áthaladáskor −10%, −5%, 0%, +10% vagy +20% változás, egyenlő eséllyel." balance={balances.biotechEquity} cash={player.cash} canTransact={canTransact} onDeposit={onDeposit} onWithdraw={onWithdraw} />
            </div>}
          </div>
          {tab !== 'loans' && <p className="bank-notice">A hozam egész KK-ra kerekítve az egyenleghez kerül. Építkezéshez és a győzelemhez előbb váltsd készpénzre.</p>}
        </div>
        <footer className="bank-footer"><button type="button" className="bank-button bank-button-secondary" onClick={onClose}>Vissza a játékhoz</button></footer>
      </div>
    </div>
  );
}

export function BankModal({ isOpen, player, ...props }: BankModalProps) {
  return isOpen && player ? <BankDialog key={player.id} player={player} {...props} /> : null;
}

export default BankModal;
