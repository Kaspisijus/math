import type { LeaderboardEntry } from '../leaderboard/api';

interface Props {
  entries: LeaderboardEntry[];
  highlightName?: string;
}

export function LeaderboardTable({ entries, highlightName }: Props) {
  if (entries.length === 0) {
    return <p className="hint">Lentelė dar tuščia – užimk pirmą vietą!</p>;
  }

  const highlightKey = highlightName?.trim().toLocaleLowerCase('lt');

  return (
    <table className="leaderboard">
      <thead>
        <tr>
          <th>Vieta</th>
          <th>Vardas</th>
          <th>Taškai</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => {
          const isMe = highlightKey !== undefined && entry.name.toLocaleLowerCase('lt') === highlightKey;
          return (
            <tr key={entry.name} className={isMe ? 'me' : undefined} aria-current={isMe ? 'true' : undefined}>
              <td>{i + 1}</td>
              <td>{entry.name}</td>
              <td>{entry.points}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
