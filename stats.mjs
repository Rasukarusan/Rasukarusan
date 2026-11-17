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

const user = await gql(
  `query($login: String!) {
    user(login: $login) {
      contributionsCollection { totalCommitContributions restrictedContributionsCount }
      pullRequests { totalCount }
      issues { totalCount }
      repositoriesContributedTo(contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) { totalCount }
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

const c = user.contributionsCollection;
const rows = [
  ["Total Stars", stars],
  ["Commits (last year)", c.totalCommitContributions + c.restrictedContributionsCount],
  ["Total PRs", user.pullRequests.totalCount],
  ["Total Issues", user.issues.totalCount],
  ["Contributed to", user.repositoriesContributedTo.totalCount],
];

const fmt = (n) => n.toLocaleString("en-US");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${60 + rows.length * 26}" viewBox="0 0 400 ${60 + rows.length * 26}">
  <style>
    .card { fill: #fffefe; stroke: #e4e2e2; }
    .title { font: 600 18px 'Segoe UI', Ubuntu, sans-serif; fill: #2f80ed; }
    .label { font: 600 14px 'Segoe UI', Ubuntu, sans-serif; fill: #434d58; }
    .value { font: 700 14px 'Segoe UI', Ubuntu, sans-serif; fill: #434d58; }
    @media (prefers-color-scheme: dark) {
      .card { fill: #0d1117; stroke: #30363d; }
      .label, .value { fill: #c9d1d9; }
      .title { fill: #58a6ff; }
    }
  </style>
  <rect class="card" x="0.5" y="0.5" width="399" height="${59 + rows.length * 26}" rx="4.5"/>
  <text class="title" x="25" y="35">${LOGIN}'s GitHub Stats</text>
${rows
  .map(
    ([label, value], i) =>
      `  <text class="label" x="25" y="${70 + i * 26}">${label}:</text>\n  <text class="value" x="375" y="${70 + i * 26}" text-anchor="end">${fmt(value)}</text>`,
  )
  .join("\n")}
</svg>
`;

writeFileSync("stats.svg", svg);
