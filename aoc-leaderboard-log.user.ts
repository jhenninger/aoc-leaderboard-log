// ==UserScript==
// @name Advent of Code Leaderboard Log
// @description Adds a simple event log to private leaderboards
// @namespace jhenninger
// @match https://adventofcode.com/*/leaderboard/private/view/*
// @grant none
// ==/UserScript==

interface Leaderboard {
  event: string;
  owner_id: string;
  members: Record<string, Member>;
}

interface Member {
  id: string;
  name: string | null;
  global_score: number;
  local_score: number;
  last_start_ts: string | 0;
  stars: number;
  completion_day_level: Record<number, CompletionDayLevel>;
}

interface CompletionDayLevel {
  1?: GetStar;
  2?: GetStar;
}

interface GetStar {
  get_star_ts: string;
}

type Part = 1 | 2;

interface Log {
  event: String,
  entries: LogEntry[];
}

interface LogEntry {
  timestamp: Date;
  member: Member;
  day: number;
  part: Part;
}

interface Cached {
  timestamp: number;
  leaderboard: Leaderboard;
}

async function getLeaderboard(): Promise<Leaderboard> {
  const cacheTime = 5 * 60 * 1000; // 5 minutes

  const now = Date.now();
  const url = `${location.pathname}.json`;
  const item = localStorage.getItem(url);

  if (item != null) {
    const cache: Cached = JSON.parse(item);
    if (now - cache.timestamp < cacheTime) {
      return cache.leaderboard;
    }
  }

  const response = await fetch(url);
  const leaderboard: Leaderboard = await response.json();
  localStorage.setItem(url, JSON.stringify({
    timestamp: now,
    leaderboard,
  }));

  return leaderboard;
}

function leaderboardToLog(leaderboard: Leaderboard): Log {
  function starToLogEntry(day: number, part: Part, gs: GetStar, member: Member): LogEntry {
    return {
      timestamp: new Date(1000 * +gs.get_star_ts),
      part,
      day,
      member,
    };
  }

  const entries = Object.values(leaderboard.members)
    .flatMap(member => Object.entries(member.completion_day_level)
      .flatMap(([day, levels]) => [
        levels[1] && starToLogEntry(+day, 1, levels[1], member),
        levels[2] && starToLogEntry(+day, 2, levels[2], member),
      ])
    )
    .filter((entry): entry is LogEntry => entry != null)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return {
    event: leaderboard.event,
    entries
  };
}

function addLogToPage(log: Log) {
  const dateFormat = new Intl.DateTimeFormat('default', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });

  const timeFormat = new Intl.DateTimeFormat('default', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const fragment = document.createDocumentFragment();

  let lastDate = null;

  for (const entry of log.entries) {
    const formattedDate = dateFormat.format(entry.timestamp);

    if (formattedDate !== lastDate) {
      const header = document.createElement('h2');
      header.innerText = formattedDate;
      lastDate = formattedDate;
      fragment.appendChild(header);
    }

    const row = document.createElement('div');
    row.classList.add('privboard-row');

    const link = document.createElement('a');
    link.innerText = entry.day.toString().padStart(2, ' ');
    link.href = `/${log.event}/day/${entry.day}`;

    row.appendChild(document.createTextNode(`${timeFormat.format(entry.timestamp)} `));
    row.appendChild(link);
    row.appendChild(document.createTextNode(' '));

    const star = document.createElement('span');
    star.innerText = '*';
    star.classList.add(entry.part === 2 ? 'privboard-star-both' : 'privboard-star-firstonly');
    row.appendChild(star);

    const user = entry.member.name ?? `(anonymous user #${entry.member.id})`;
    row.appendChild(document.createTextNode(` ${user}`));

    fragment.appendChild(row);
  }

  const article = document.getElementsByTagName('article')[0];
  article.appendChild(fragment);
}

getLeaderboard()
  .then(leaderboardToLog)
  .then(addLogToPage);