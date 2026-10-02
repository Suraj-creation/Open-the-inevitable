/**
 * Headline-test child: a real host process over a Postgres store. It boots (taking every unfinished
 * process), wakes processes on admissions (inbox watch) and on a periodic supervision sweep, and
 * drives them until the parent kills it. It holds nothing the next host needs: everything is in the
 * store and the channel's outbox.
 */
import { PostgresCausalStore } from "@uci/adapters";
import { ScriptedTutorFaculty, TutorEnvironment } from "@uci/env-tutor";
import { PROCESS_KINDS } from "@uci/harness";
import { Host } from "@uci/host";
import { systemClock } from "@uci/kernel";

const [url, schema, channelDir] = process.argv.slice(2) as [string, string, string];
const store = await PostgresCausalStore.open({
  connectionString: url,
  schema,
  registry: PROCESS_KINDS,
  max: 6,
});
// The learner is outside this process (the parent answers from the outbox): no reply sink here.
const env = new TutorEnvironment(channelDir, { misconception: true });
const host = new Host({
  store,
  clock: systemClock,
  owner: `child-${process.pid}`,
  env,
  faculty: new ScriptedTutorFaculty(),
});
await host.boot();
void host.watchInboxes(new AbortController().signal);
setInterval(() => {
  host.tick();
  for (const id of host.ownedProcesses()) host.ring(id);
}, 1_000);
