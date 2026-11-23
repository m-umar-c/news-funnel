export type ProfileId = 'backend' | 'frontend' | 'security';

export interface LabeledItem {
  id: string;
  title: string;
  text: string;
  rel: ProfileId[];
}

export const profiles: Record<ProfileId, string[]> = {
  backend: ['postgres and database performance', 'distributed systems and cloud infrastructure'],
  frontend: ['react and javascript frameworks', 'web performance and css'],
  security: ['vulnerabilities and exploits', 'authentication and encryption'],
};

// Hand-written headlines in the style of the feeds the app ingests, labeled by the author.
// Several relevant items avoid the profile's exact words on purpose, so a keyword match alone misses them.
export const items: LabeledItem[] = [
  // data and infrastructure
  { id: 'db1', title: 'Vacuum improvements land in the next major release', text: 'The storage engine now reclaims dead rows without blocking concurrent writers, which should cut table bloat on busy transactional workloads.', rel: ['backend'] },
  { id: 'db2', title: 'Why our queries slowed down after the schema migration', text: 'A missing composite index turned a millisecond lookup into a sequential scan across forty million rows. Here is how the planner statistics misled us.', rel: ['backend'] },
  { id: 'db3', title: 'Postgres 18 adds asynchronous I/O for sequential scans', text: 'Benchmarks show large tables scanning noticeably faster, with the biggest gains on cloud volumes where latency dominates.', rel: ['backend'] },
  { id: 'db4', title: 'Replication lag at scale: lessons from a failover gone wrong', text: 'Our primary crashed and the replica was thirty seconds behind. We now monitor write-ahead log positions and fence stale leaders.', rel: ['backend'] },
  { id: 'db5', title: 'Sharding a relational database without rewriting the app', text: 'We split a multi-terabyte customer table across nodes using a routing layer, keeping transactions single-shard wherever possible.', rel: ['backend'] },
  { id: 'inf1', title: 'Kubernetes 1.34 reworks how pods get scheduled', text: 'The scheduler now understands topology across zones, reducing cross-region traffic for stateful services running in the cluster.', rel: ['backend'] },
  { id: 'inf2', title: 'A postmortem on a cascading retry storm', text: 'One slow dependency caused every service to retry at once, saturating the load balancer. Backoff with jitter and circuit breakers fixed it.', rel: ['backend'] },
  { id: 'inf3', title: 'Consensus protocols explained with a toy implementation', text: 'We build a small Raft cluster in two hundred lines to show leader election, log replication, and what happens during a network partition.', rel: ['backend'] },
  { id: 'inf4', title: 'Cloud provider outage takes down object storage in one region', text: 'Customers saw elevated errors for four hours as the control plane struggled to rebalance capacity across availability zones.', rel: ['backend'] },
  { id: 'inf5', title: 'Cutting our container image from 1.2 GB to 80 MB', text: 'Multi-stage builds, a distroless base, and removing build tooling shrank deploys and sped up autoscaling across the fleet.', rel: ['backend'] },
  // frontend
  { id: 'fe1', title: 'React compiler reaches stable and removes manual memoization', text: 'The build step now analyzes components and inserts caching automatically, so developers can drop most useMemo and useCallback calls.', rel: ['frontend'] },
  { id: 'fe2', title: 'Server components changed how we fetch data in the browser', text: 'Moving data loading to the server shrank our client bundle and eliminated a waterfall of requests on first render.', rel: ['frontend'] },
  { id: 'fe3', title: 'CSS container queries are finally everywhere', text: 'Components can now adapt to the space they are given rather than the viewport, making truly reusable layouts practical.', rel: ['frontend'] },
  { id: 'fe4', title: 'How we improved Largest Contentful Paint by 40 percent', text: 'Preloading the hero image, inlining critical styles, and deferring a heavy analytics script made pages feel instant on mid-range phones.', rel: ['frontend'] },
  { id: 'fe5', title: 'The hidden cost of too many npm dependencies', text: 'Our bundle pulled in six copies of the same utility library. Tree shaking and a dependency audit removed 300 kilobytes of JavaScript.', rel: ['frontend'] },
  { id: 'fe6', title: 'View transitions land in every major browser', text: 'Animating between pages and states no longer needs a framework, just a few lines of script and some styling rules.', rel: ['frontend'] },
  { id: 'fe7', title: 'TypeScript 6 speeds up type checking with a native compiler', text: 'Large front-end monorepos should see editor feedback and builds several times faster after the compiler rewrite.', rel: ['frontend'] },
  { id: 'fe8', title: 'Debugging layout shift: a field guide', text: 'Unreserved image dimensions and late-loading fonts were moving buttons under users fingers. Cumulative layout shift dropped to near zero.', rel: ['frontend'] },
  { id: 'fe9', title: 'Why we left a single-page app for plain HTML forms', text: 'Progressive enhancement gave us faster loads and fewer bugs, and the pages still worked when scripts failed to load.', rel: ['frontend'] },
  { id: 'fe10', title: 'Accessibility audits found that most of our modals trapped focus badly', text: 'Keyboard users could tab out of dialogs into hidden content. We rebuilt them on the native dialog element.', rel: ['frontend'] },
  // security
  { id: 'sec1', title: 'Critical remote code execution flaw found in a popular VPN appliance', text: 'Attackers are chaining a path traversal bug with an unauthenticated endpoint. Administrators should patch immediately.', rel: ['security'] },
  { id: 'sec2', title: 'Phishing kit bypasses multi-factor prompts with real-time relays', text: 'The proxy captures session cookies after the victim approves a push notification, letting criminals sign in as them.', rel: ['security'] },
  { id: 'sec3', title: 'Passkeys finally replace passwords at a major bank', text: 'Customers can now sign in with a fingerprint or face scan. The bank says account takeover attempts fell sharply after rollout.', rel: ['security'] },
  { id: 'sec4', title: 'How a leaked access token exposed millions of customer records', text: 'An engineer committed credentials to a public repository. Scanners found them within minutes and the data was copied.', rel: ['security', 'backend'] },
  { id: 'sec5', title: 'Supply chain attack hits widely used JavaScript package', text: 'A maintainer account was compromised and a malicious release stole environment secrets from build servers.', rel: ['security', 'frontend'] },
  { id: 'sec6', title: 'Researchers break a widely deployed hashing scheme', text: 'Collision attacks are now practical for a few thousand dollars, so anything still relying on it for signatures should migrate.', rel: ['security'] },
  { id: 'sec7', title: 'Zero-day in a browser engine exploited in the wild', text: 'A use-after-free in the rendering code lets a crafted web page run code outside the sandbox. Updates are rolling out.', rel: ['security', 'frontend'] },
  { id: 'sec8', title: 'Ransomware gang leaks data after hospital refuses to pay', text: 'Stolen patient files appeared on a leak site. The hospital says its backups were intact but encrypted systems stayed offline for days.', rel: ['security'] },
  { id: 'sec9', title: 'Why you should stop rolling your own session tokens', text: 'Predictable identifiers and missing expiry let an attacker hijack sessions. Use a vetted library with rotating, signed cookies.', rel: ['security', 'backend'] },
  { id: 'sec10', title: 'End-to-end encryption comes to group video calls', text: 'The new protocol keeps keys on participants devices so the service itself cannot decrypt meetings, even under legal pressure.', rel: ['security'] },
  // ai and models
  { id: 'ai1', title: 'A new open-weight model matches last years frontier on coding tasks', text: 'The 30 billion parameter release runs on a single workstation GPU and scores competitively on programming benchmarks.', rel: [] },
  { id: 'ai2', title: 'Agents that write pull requests are showing up in real repositories', text: 'Maintainers report mixed results: routine fixes land fine, but reviewers spend time catching subtle mistakes in generated changes.', rel: ['frontend', 'backend'] },
  { id: 'ai3', title: 'Prompt injection lets a web page hijack an AI browsing assistant', text: 'Hidden instructions in page text made the assistant leak the users data. Researchers say input filtering alone is not enough.', rel: ['security'] },
  { id: 'ai4', title: 'Fine-tuning small models for structured output', text: 'We trained a compact model to emit valid JSON for support tickets and cut inference cost by ninety percent versus a large hosted model.', rel: [] },
  { id: 'ai5', title: 'Vector search in the database you already run', text: 'Adding an embedding index to an existing relational store avoided a new service and kept transactions and similarity queries together.', rel: ['backend'] },
  { id: 'ai6', title: 'Benchmark contamination is quietly inflating model scores', text: 'Test questions leaked into training data, so headline numbers overstate real capability on unseen problems.', rel: [] },
  { id: 'ai7', title: 'Chip makers race to supply inference hardware', text: 'Demand for accelerators keeps outpacing supply, and cloud providers are signing multi-year capacity deals.', rel: [] },
  { id: 'ai8', title: 'Voice assistants get a memory of past conversations', text: 'The update stores preferences across sessions, with a setting to review and delete what the assistant remembers.', rel: [] },
  { id: 'ai9', title: 'Evaluating retrieval pipelines with a labeled question set', text: 'We measured how often the right passage appeared in the top five results and found chunk size mattered more than the embedding model.', rel: [] },
  { id: 'ai10', title: 'Image generators now handle legible text in posters', text: 'The latest release renders signs and labels correctly, a long-standing weakness of earlier diffusion models.', rel: [] },
  // general tech and business
  { id: 'biz1', title: 'Smartphone makers brace for another year of flat sales', text: 'Analysts expect upgrades to stay sluggish as consumers hold their devices longer.', rel: [] },
  { id: 'biz2', title: 'Streaming service raises prices for the third time', text: 'Subscribers will pay two dollars more per month starting next billing cycle, the company announced on Tuesday.', rel: [] },
  { id: 'biz3', title: 'Electric vehicle maker recalls thousands of cars over software fault', text: 'An over-the-air patch will fix a display bug that can hide warning lights on the dashboard.', rel: [] },
  { id: 'biz4', title: 'Startup raises $60 million to automate warehouse picking', text: 'The robotics company says its machines can sort parcels at three times human speed.', rel: [] },
  { id: 'biz5', title: 'Government opens antitrust review of app store fees', text: 'Regulators will examine whether commission rates harm developers and consumers.', rel: [] },
  { id: 'biz6', title: 'Game studio announces layoffs after a delayed release', text: 'About 200 employees are affected as the studio pushes its flagship title into next year.', rel: [] },
  { id: 'biz7', title: 'New laptop review: thin, quiet, and surprisingly fast', text: 'Battery life lasts a full workday, though the keyboard feels shallow compared with last years model.', rel: [] },
  { id: 'biz8', title: 'Space company completes its tenth reusable booster landing', text: 'The latest launch carried a batch of communications satellites into low orbit.', rel: [] },
  { id: 'biz9', title: 'Telecom carrier merges with cable provider in a $20 billion deal', text: 'The combined company would serve 40 million customers and says it will invest in rural broadband.', rel: [] },
  { id: 'biz10', title: 'Open-source maintainers ask companies to fund the projects they depend on', text: 'A coalition published a pledge asking businesses to pay for critical libraries that run their products.', rel: ['backend', 'security'] },
];
