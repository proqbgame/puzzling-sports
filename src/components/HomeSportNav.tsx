import { useState, type ReactNode } from "react";

interface PuzzleOption {
  value: string;
  label: string;
  detail: string;
  href: string;
}

interface HomeSportNavProps {
  puzzleDate: string;
}

export function HomeSportNav({ puzzleDate }: HomeSportNavProps) {
  const nflOptions: PuzzleOption[] = [
    {
      value: "qb",
      label: "Quarterback",
      detail: "Pass yards · TD · COMP% · INT",
      href: `?sport=nfl&position=qb&date=${puzzleDate}`,
    },
    {
      value: "wr",
      label: "Wide receiver",
      detail: "Rec yards · receptions · targets · TD",
      href: `?sport=nfl&position=wr&date=${puzzleDate}`,
    },
    {
      value: "rb",
      label: "Running back",
      detail: "Rush yards · rush TD · rec yards · rec TD",
      href: `?sport=nfl&position=rb&date=${puzzleDate}`,
    },
  ];

  const mlbOptions: PuzzleOption[] = [
    {
      value: "hitter",
      label: "Batter",
      detail: "HR · RBI · AVG · SB",
      href: `?sport=mlb&position=hitter&date=${puzzleDate}`,
    },
    {
      value: "pitcher",
      label: "Pitcher",
      detail: "SO · W · IP · ERA",
      href: `?sport=mlb&position=pitcher&date=${puzzleDate}`,
    },
  ];

  return (
    <nav className="home-sport-nav" aria-label="Sports">
      <a
        className="home-sport-card home-sport-card-link"
        href={`?sport=nba&date=${puzzleDate}`}
      >
        <span className="home-sport-heading">
          <BasketballIcon />
          <span className="home-sport-label">NBA</span>
        </span>
        <span className="home-sport-detail">
          Points · rebounds · assists · blocks
        </span>
        <span className="home-sport-cta">Play today&apos;s puzzle</span>
      </a>

      <SportDropdownCard
        title="NFL"
        icon={<FootballIcon />}
        summary="Choose QB, WR, or RB"
        options={nflOptions}
        selectId="home-nfl-puzzle"
      />

      <SportDropdownCard
        title="MLB"
        icon={<BaseballIcon />}
        summary="Choose batter or pitcher"
        options={mlbOptions}
        selectId="home-mlb-puzzle"
      />
    </nav>
  );
}

function SportDropdownCard({
  title,
  icon,
  summary,
  options,
  selectId,
}: {
  title: string;
  icon: ReactNode;
  summary: string;
  options: PuzzleOption[];
  selectId: string;
}) {
  const [selected, setSelected] = useState(options[0].value);
  const current = options.find((option) => option.value === selected) ?? options[0];

  return (
    <div className="home-sport-card">
      <span className="home-sport-heading">
        {icon}
        <span className="home-sport-label">{title}</span>
      </span>
      <span className="home-sport-detail">{summary}</span>

      <label className="home-sport-select-label" htmlFor={selectId}>
        Puzzle
        <select
          id={selectId}
          className="home-sport-select"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <p className="home-sport-option-detail">{current.detail}</p>

      <a className="home-sport-cta home-sport-cta-button" href={current.href}>
        Play today&apos;s puzzle
      </a>
    </div>
  );
}

function BasketballIcon() {
  return (
    <svg
      className="home-sport-icon"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="24" cy="24" r="20" fill="#c45a12" />
      <path
        d="M24 4c0 11 0 29 0 40M4.8 18c12 4 26.4 4 38.4 0M4.8 30c12-4 26.4-4 38.4 0M14 7.2c7 8.8 7 24.8 0 33.6M34 7.2c-7 8.8-7 24.8 0 33.6"
        fill="none"
        stroke="rgba(12, 18, 32, 0.55)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="rgba(255, 210, 150, 0.35)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function FootballIcon() {
  return (
    <svg
      className="home-sport-icon"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse
        cx="24"
        cy="24"
        rx="11"
        ry="20"
        transform="rotate(-35 24 24)"
        fill="#6b4423"
      />
      <ellipse
        cx="24"
        cy="24"
        rx="11"
        ry="20"
        transform="rotate(-35 24 24)"
        fill="none"
        stroke="rgba(255, 210, 150, 0.3)"
        strokeWidth="1.5"
      />
      <path
        d="M17 14.5c4.5-2.8 9.5-2.8 14 0M17 33.5c4.5 2.8 9.5 2.8 14 0"
        fill="none"
        stroke="#e8e0d4"
        strokeWidth="2"
        strokeLinecap="round"
        transform="rotate(-35 24 24)"
      />
      <path
        d="M24 16.5v15M20.5 20.5h7M20.5 24h7M20.5 27.5h7"
        fill="none"
        stroke="#e8e0d4"
        strokeWidth="1.8"
        strokeLinecap="round"
        transform="rotate(-35 24 24)"
      />
    </svg>
  );
}

function BaseballIcon() {
  return (
    <svg
      className="home-sport-icon"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="24" cy="24" r="20" fill="#f2efe6" />
      <circle
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="rgba(12, 18, 32, 0.2)"
        strokeWidth="1.5"
      />
      <path
        d="M10 12c7 5 7 19 0 24M38 12c-7 5-7 19 0 24"
        fill="none"
        stroke="#c62828"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12.5 15.5l2 1.5M12.2 20l2.3 1M12.2 25l2.3 1M12.5 30l2 1.5M33.5 15.5l-2 1.5M33.8 20l-2.3 1M33.8 25l-2.3 1M33.5 30l-2 1.5"
        fill="none"
        stroke="#c62828"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
