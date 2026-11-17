import { writeFileSync } from "node:fs";

const LOGIN = "Rasukarusan";

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user;
}

const { contributionsCollection: c, top } = await gql(
  `query($login: String!) {
    user(login: $login) {
      top: repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 3, orderBy: { field: STARGAZERS, direction: DESC }) {
        nodes { name stargazerCount }
      }
      contributionsCollection {
        totalCommitContributions
        restrictedContributionsCount
        contributionCalendar { totalContributions weeks { contributionDays { contributionCount } } }
      }
    }
  }`,
  { login: LOGIN },
);

let stars = 0;
let after = null;
do {
  const { repositories } = await gql(
    `query($login: String!, $after: String) {
      user(login: $login) {
        repositories(ownerAffiliations: OWNER, isFork: false, first: 100, after: $after) {
          nodes { stargazerCount }
          pageInfo { hasNextPage endCursor }
        }
      }
    }`,
    { login: LOGIN, after },
  );
  stars += repositories.nodes.reduce((sum, r) => sum + r.stargazerCount, 0);
  after = repositories.pageInfo.hasNextPage ? repositories.pageInfo.endCursor : null;
} while (after);

const commits = c.totalCommitContributions + c.restrictedContributionsCount;
const total = c.contributionCalendar.totalContributions;
const weeks = c.contributionCalendar.weeks.map((w) =>
  w.contributionDays.reduce((sum, d) => sum + d.contributionCount, 0),
);
const time = new Date().toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });
const fmt = (n) => n.toLocaleString("en-US");

// jellybeans
const COLOR = {
  bg: "#151515",
  bar: "#252525",
  fg: "#e8e8d3",
  gray: "#888888",
  cyan: "#8fbfdc",
  green: "#99ad6a",
  yellow: "#fad07a",
  red: "#cf6a4c",
};

const W = 520;
const H = 344;
const X = 20;
const LH = 22;
const CMD = "gh stats";
const CH = 8.4; // 14px monospace の 1 文字幅

// 1 行ずつ出力されるように見せる
let line = 0;
const out = (body) => {
  const delay = (1.5 + line * 0.06).toFixed(2);
  line++;
  return `<g class="out" style="animation-delay:${delay}s">${body}</g>`;
};

const STEP = (W - X * 2) / weeks.length;
const max = Math.max(...weeks, 1);
const graphTop = 66 + LH * 8;
const graph = weeks
  .map((n, i) => {
    const h = Math.max(2, Math.ceil((n / max) * 8) * 5);
    return `<rect x="${(X + i * STEP).toFixed(1)}" y="${graphTop + 40 - h}" width="${(STEP - 2).toFixed(1)}" height="${h}" fill="${n === 0 ? COLOR.bar : COLOR.green}"/>`;
  })
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>
    text { font: 14px ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace; white-space: pre; }
    svg { fill: ${COLOR.fg}; }
    .b { font-weight: 700; }
    .typing { animation: type .8s steps(${CMD.length}) .4s backwards; }
    .out { animation: show .01s backwards; }
    .cursor { animation: blink 1s step-end infinite; }
    @keyframes type { from { transform: translateX(0); } }
    @keyframes show { from { opacity: 0; } }
    @keyframes blink { 50% { opacity: 0; } }
  </style>
  <rect width="${W}" height="${H}" rx="8" fill="${COLOR.bg}"/>
  <path d="M0 8a8 8 0 0 1 8-8h${W - 16}a8 8 0 0 1 8 8v20H0Z" fill="${COLOR.bar}"/>
  <circle cx="18" cy="14" r="5.5" fill="#ff5f57"/>
  <circle cx="36" cy="14" r="5.5" fill="#febc2e"/>
  <circle cx="54" cy="14" r="5.5" fill="#28c840"/>
  <text x="${W / 2}" y="19" text-anchor="middle" style="font-size:12px;fill:${COLOR.gray}">zsh</text>

  <text x="${X}" y="${66}"><tspan fill="${COLOR.cyan}">~/${LOGIN}</tspan><tspan fill="${COLOR.green}">  master ✔</tspan></text>
  <text x="${W - X}" y="${66}" text-anchor="end" fill="${COLOR.gray}">${time}</text>
  <text x="${X}" y="${66 + LH}">$ ${CMD}</text>
  <rect class="typing" x="${X + CH * 2}" y="${66 + LH - 15}" width="${CH * CMD.length + 2}" height="20" fill="${COLOR.bg}" style="transform:translateX(${CH * CMD.length + 2}px)"/>

  ${out(`<text x="${X}" y="${66 + LH * 2.5}"><tspan fill="${COLOR.yellow}">★</tspan> stars</text><text class="b" x="${X + CH * 12}" y="${66 + LH * 2.5}">${fmt(stars)}</text>`)}
  ${top.nodes
    .map((r, i) => {
      const y = 66 + LH * (2.5 + i);
      const branch = i === top.nodes.length - 1 ? "└─" : "├─";
      return out(`<text x="${X + CH * 18}" y="${y}" fill="${COLOR.gray}">${branch}</text><text x="${X + CH * 21}" y="${y}" fill="${COLOR.cyan}">${r.name}</text><text x="${W - X}" y="${y}" text-anchor="end" fill="${COLOR.yellow}">★ ${fmt(r.stargazerCount)}</text>`);
    })
    .join("\n  ")}
  ${out(`<text x="${X}" y="${66 + LH * 5.5}"><tspan fill="${COLOR.green}">●</tspan> commits</text><text class="b" x="${X + CH * 12}" y="${66 + LH * 5.5}">${fmt(commits)}</text><text x="${X + CH * 20}" y="${66 + LH * 5.5}" fill="${COLOR.gray}"># last year</text>`)}
  ${out(`<text x="${X}" y="${66 + LH * 7}" fill="${COLOR.gray}"># ${fmt(total)} contributions in the last year</text>`)}
  ${out(graph)}

  ${out(`<text x="${X}" y="${H - 18}">$ <tspan class="cursor" fill="${COLOR.fg}">█</tspan></text>`)}
</svg>
`;

writeFileSync("stats.svg", svg);
