import { useId } from 'react';
import { Check, LockKeyhole, Plus } from 'lucide-react';
import type { ClinicElement, ClinicElementId } from '../../types/game.ts';
import type { ClinicRoomState } from './clinicVisuals.ts';

interface BlueprintRoom {
  element: ClinicElement;
  image: string;
  shortName: string;
  status: ClinicRoomState;
}

interface ClinicBlueprintProps {
  rooms: BlueprintRoom[];
  selectedId: ClinicElementId;
  onSelectRoom: (id: ClinicElementId) => void;
}

const STATE_LABELS: Record<ClinicRoomState, string> = {
  built: 'felépült',
  available: 'megvásárolható',
  locked: 'zárolt',
};

export function ClinicBlueprint({ rooms, selectedId, onSelectRoom }: ClinicBlueprintProps) {
  const blueprintId = useId();

  return (
    <section className="clinic-blueprint" aria-labelledby={`${blueprintId}-title`}>
      <div className="clinic-blueprint-heading">
        <div>
          <h3 id={`${blueprintId}-title`}>Klinika tervrajza</h3>
          <p>Válassz részleget a részletekhez.</p>
        </div>
        <ul className="clinic-blueprint-legend" aria-label="Részlegállapotok">
          <li><span className="clinic-legend-dot clinic-legend-dot--locked" />Zárolt</li>
          <li><span className="clinic-legend-dot clinic-legend-dot--available" />Megvásárolható</li>
          <li><span className="clinic-legend-dot clinic-legend-dot--built" />Felépült</li>
        </ul>
      </div>

      <div className="clinic-blueprint-building">
        <svg className="clinic-blueprint-structure" viewBox="0 0 960 640" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs>
            <pattern id={`${blueprintId}-grid`} width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="#2e5367" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="960" height="640" fill={`url(#${blueprintId}-grid)`} opacity="0.25" />
          <path d="M45 605H725L817 525H944" fill="none" stroke="#456b7e" strokeWidth="2" strokeDasharray="6 8" />
          <path d="M72 590H705L795 515V540L705 615H72Z" fill="#102c3b" stroke="#416177" strokeWidth="2" />
          <path d="M95 205L175 135H780V520L700 590H95Z" fill="#0b2635" stroke="#4f7c93" strokeWidth="2" />
          <path d="M700 205L780 135V520L700 590Z" fill="#153746" stroke="#426c7f" strokeWidth="2" />
          <path d="M95 205L175 135H780L700 205Z" fill="#254b5a" stroke="#5d91a6" strokeWidth="2" />
          <path d="M95 205H700V590H95Z" fill="#081823" stroke="#4d778a" strokeWidth="2" />
          <path d="M95 334H700L780 264V280L700 350H95ZM95 464H700L780 394V410L700 480H95Z" fill="#244450" stroke="#4b7486" strokeWidth="2" />
          <path d="M95 205H112V590H95ZM680 205H700V590H680ZM374 205H404V590H374Z" fill="#1e3d4b" stroke="#456c7d" strokeWidth="1.5" />
          <path d="M379 223H399M379 239H399M379 255H399M379 271H399M379 287H399M379 303H399M379 369H399M379 385H399M379 401H399M379 417H399M379 433H399M379 499H399M379 515H399M379 531H399M379 547H399M379 563H399" stroke="#5c8192" strokeWidth="2" />
          <path d="M720 235L758 202V249L720 282ZM720 365L758 332V379L720 412ZM720 495L758 462V509L720 542Z" fill="#2b5260" stroke="#638596" strokeWidth="1.5" />
          <path d="M713 577L783 516H936V580L865 619H713Z" fill="#152f39" stroke="#4c7380" strokeWidth="2" />
          <path d="M711 601H939M813 595V616M848 595V616M883 595V616M918 595V616" stroke="#3f6674" strokeWidth="2" />
          <path d="M56 196V588M48 206H64M48 335H64M48 465H64M48 588H64" stroke="#396175" strokeWidth="1.5" />
          <text x="24" y="278" fill="#7094a6" fontSize="17" fontFamily="system-ui">02</text>
          <text x="24" y="408" fill="#7094a6" fontSize="17" fontFamily="system-ui">01</text>
          <text x="24" y="538" fill="#7094a6" fontSize="17" fontFamily="system-ui">00</text>
          <path d="M280 616H492L469 637H255Z" fill="#274554" stroke="#5e7f90" />
          <path d="M107 92H235M107 92V105M235 92V105" fill="none" stroke="#49768a" strokeWidth="1.5" />
          <text x="108" y="79" fill="#78a4b9" fontSize="15" letterSpacing="2" fontFamily="system-ui">CODEBLUE</text>
        </svg>

        <div className="clinic-blueprint-zones" role="group" aria-label="A klinika nyolc részlege">
          {rooms.map(({ element, image, shortName, status }) => {
            const StatusIcon = status === 'built' ? Check : status === 'available' ? Plus : LockKeyhole;
            return (
              <button
                key={element.id}
                className={`clinic-blueprint-zone clinic-blueprint-zone--${element.id} clinic-blueprint-zone--${status}`}
                type="button"
                aria-label={`${element.name}, ${STATE_LABELS[status]}. Részletek megtekintése`}
                aria-pressed={selectedId === element.id}
                onClick={() => onSelectRoom(element.id)}
              >
                <img src={image} alt="" width="768" height="512" loading="lazy" />
                <span className="clinic-blueprint-zone-number">{element.order}</span>
                <StatusIcon className="clinic-blueprint-zone-status" aria-hidden="true" />
                <span className="clinic-blueprint-zone-name">{shortName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
