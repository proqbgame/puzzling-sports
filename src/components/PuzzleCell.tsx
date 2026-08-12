import { useEffect, useState, type ReactNode } from "react";
import type { DailyPuzzleBase } from "../puzzle/types.js";
import type {
  DailyNflPuzzleBase,
  DailyNflPuzzleBaseStats,
  DailyNflQbBaseStats,
  DailyNflRbBaseStats,
  DailyNflWrBaseStats,
} from "../puzzle/nfl/types.js";
import type { CellId } from "../rules/grid.js";
import type { EdgeTopology } from "../rules/topology.js";
import type { PlayerSeasonAssignment as NbaAssignment } from "../types/nba.js";
import type { PlayerSeasonAssignment as NflAssignment } from "../types/nfl.js";
import { headshotUrlForSport } from "../utils/playerHeadshot.js";
import { cellContentInset } from "./puzzlePiecePath.js";

type AnyAssignment = NbaAssignment | NflAssignment;
type AnyBaseStats = DailyPuzzleBase["stats"] | DailyNflPuzzleBase["stats"];

interface PuzzleCellProps {
  cellId: CellId;
  isCenter: boolean;
  baseStats?: AnyBaseStats;
  assignment?: AnyAssignment;
  selected: boolean;
  locked: boolean;
  sport?: "nba" | "nfl";
  topology?: EdgeTopology | null;
  onSelect: () => void;
  onHoverChange: (hovered: boolean) => void;
}

function isNflQbStats(
  stats: AnyBaseStats | AnyAssignment["stats"],
): stats is DailyNflQbBaseStats {
  return "passYds" in stats;
}

function isNflRbStats(
  stats: AnyBaseStats | AnyAssignment["stats"],
): stats is DailyNflRbBaseStats {
  return "rushYds" in stats && "recYds" in stats && !("passYds" in stats);
}

function isNflWrStats(
  stats: AnyBaseStats | AnyAssignment["stats"],
): stats is DailyNflWrBaseStats {
  return (
    "recYds" in stats &&
    "receptions" in stats &&
    !("passYds" in stats) &&
    !("rushYds" in stats)
  );
}

function isNflStats(
  stats: AnyBaseStats | AnyAssignment["stats"],
): stats is DailyNflPuzzleBaseStats | NflAssignment["stats"] {
  return (
    isNflQbStats(stats) ||
    isNflWrStats(stats) ||
    isNflRbStats(stats) ||
    "position" in stats
  );
}

function formatMiniStats(assignment: AnyAssignment): string {
  if ("position" in assignment.stats && assignment.stats.position === "RB") {
    return `${assignment.stats.rushYds ?? 0} / ${assignment.stats.rushTd ?? 0} / ${assignment.stats.recYds} / ${assignment.stats.recTd}`;
  }
  if ("position" in assignment.stats && assignment.stats.position === "WR") {
    return `${assignment.stats.recYds} / ${assignment.stats.recTd} / ${assignment.stats.receptions} / ${assignment.stats.targets}`;
  }
  if (isNflQbStats(assignment.stats)) {
    return `${assignment.stats.passYds} / ${assignment.stats.passTd} / ${assignment.stats.compPct}% / ${assignment.stats.interceptions}`;
  }
  if ("ppg" in assignment.stats) {
    return `${assignment.stats.ppg} / ${assignment.stats.rpg} / ${assignment.stats.apg} / ${assignment.stats.blk}`;
  }
  return "";
}

function espnIdFromAssignment(assignment: AnyAssignment): string | null {
  const bio = assignment.bio as { espnId?: string | null };
  const raw = bio.espnId;
  if (raw == null) {
    return null;
  }
  const id = String(raw).trim();
  return id.length > 0 ? id : null;
}

/** Prefer explicit sport prop; fall back to assignment shape if prop is wrong/defaulted. */
function resolveHeadshotSport(
  sport: "nba" | "nfl",
  assignment: AnyAssignment,
): "nba" | "nfl" {
  if (sport === "nfl") {
    return "nfl";
  }
  if (espnIdFromAssignment(assignment) || "position" in assignment.stats) {
    return "nfl";
  }
  return "nba";
}

function OuterFilledContent({
  assignment,
  sport,
}: {
  assignment: AnyAssignment;
  sport: "nba" | "nfl";
}) {
  const resolvedSport = resolveHeadshotSport(sport, assignment);
  const espnId = espnIdFromAssignment(assignment);
  const src = headshotUrlForSport(
    resolvedSport,
    assignment.playerId,
    espnId,
  );
  const [imageFailed, setImageFailed] = useState(!src);

  useEffect(() => {
    setImageFailed(
      !headshotUrlForSport(resolvedSport, assignment.playerId, espnId),
    );
  }, [assignment.playerId, assignment.season, resolvedSport, espnId]);

  if (!src || imageFailed) {
    return (
      <div className="cell-content">
        <strong>{assignment.playerName}</strong>
        <span>{assignment.season}</span>
        <span className="mini-stats">{formatMiniStats(assignment)}</span>
      </div>
    );
  }

  return (
    <div className="cell-content cell-content-headshot">
      <div className="cell-headshot-wrap">
        <img
          key={src}
          className="cell-headshot"
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
        <div className="cell-headshot-overlay">
          <strong>{assignment.playerName}</strong>
          <span>{assignment.season}</span>
        </div>
      </div>
      <span className="mini-stats cell-headshot-stats">
        {formatMiniStats(assignment)}
      </span>
    </div>
  );
}

function CenterStatEdges({
  baseStats,
  identity,
}: {
  baseStats: AnyBaseStats;
  identity: ReactNode;
}) {
  if (isNflRbStats(baseStats)) {
    return (
      <>
        <span className="stat-edge stat-up">RUSH YDS {baseStats.rushYds}</span>
        <span className="stat-edge stat-left">REC YDS {baseStats.recYds}</span>
        <div className="center-identity">{identity}</div>
        <span className="stat-edge stat-right">REC TD {baseStats.recTd}</span>
        <span className="stat-edge stat-down">RUSH TD {baseStats.rushTd}</span>
      </>
    );
  }

  if (isNflWrStats(baseStats)) {
    return (
      <>
        <span className="stat-edge stat-up">REC YDS {baseStats.recYds}</span>
        <span className="stat-edge stat-left">REC {baseStats.receptions}</span>
        <div className="center-identity">{identity}</div>
        <span className="stat-edge stat-right">TGT {baseStats.targets}</span>
        <span className="stat-edge stat-down">REC TD {baseStats.recTd}</span>
      </>
    );
  }

  if (isNflQbStats(baseStats)) {
    return (
      <>
        <span className="stat-edge stat-up">PASS YDS {baseStats.passYds}</span>
        <span className="stat-edge stat-left">{baseStats.compPct}%</span>
        <div className="center-identity">{identity}</div>
        <span className="stat-edge stat-right">INT {baseStats.interceptions}</span>
        <span className="stat-edge stat-down">PASS TD {baseStats.passTd}</span>
      </>
    );
  }

  return (
    <>
      <span className="stat-edge stat-up">PPG {baseStats.ppg}</span>
      <span className="stat-edge stat-left">RPG {baseStats.rpg}</span>
      <div className="center-identity">{identity}</div>
      <span className="stat-edge stat-right">BLK {baseStats.blk}</span>
      <span className="stat-edge stat-down">AST {baseStats.apg}</span>
    </>
  );
}

export function PuzzleCell({
  cellId,
  isCenter,
  baseStats,
  assignment,
  selected,
  locked,
  sport = "nba",
  topology,
  onSelect,
  onHoverChange,
}: PuzzleCellProps) {
  const filled = Boolean(assignment);

  const className = [
    "puzzle-cell",
    isCenter ? "is-center" : "",
    filled ? "is-filled" : "",
    locked ? "is-locked" : "",
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = assignment ? (
    isCenter ? (
      <div className="cell-content">
        <strong>{assignment.playerName}</strong>
        <span>{assignment.season}</span>
      </div>
    ) : (
      <OuterFilledContent assignment={assignment} sport={sport} />
    )
  ) : (
    <div className="cell-content empty">
      <span>{isCenter ? "Base Player" : "Tap to guess"}</span>
    </div>
  );

  const outerFilled = filled && !isCenter;

  return (
    <div
      className={className}
      data-cell={cellId}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div className="piece-content" style={{ inset: cellContentInset(cellId, topology) }}>
        {isCenter && baseStats ? (
          <div className="center-layout">
            <CenterStatEdges baseStats={baseStats} identity={content} />
          </div>
        ) : isCenter ? (
          <div className="cell-button center-display">{content}</div>
        ) : (
          <button
            type="button"
            className={["cell-button", outerFilled ? "has-headshot" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={onSelect}
            disabled={locked}
          >
            {content}
          </button>
        )}
      </div>
    </div>
  );
}
