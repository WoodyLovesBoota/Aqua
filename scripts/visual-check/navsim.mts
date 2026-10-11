// navStep 단독 시뮬레이션: 소크 테스트에서 갇혔던 상태를 넣고 N초 돌려 빠져나오는지 본다 (브라우저 없이).
// usage: pnpm check:navsim  = node --experimental-strip-types --no-warnings --import ./scripts/ts-alias.mjs scripts/visual-check/navsim.mts
import * as THREE from "three";
import { blocked, type NavAgent, navStep } from "@/components/sea/lagoonNav";
import { floorHeight } from "@/components/sea/lagoonHeight";
import { dolphin, manta, whaleshark } from "@/components/sea/swimBehaviours";
import type { Behaviour } from "@/components/sea/LagoonSwimmer";

const TANK_BOTTOM = -2.8;
function run(b: Behaviour, pos: [number, number, number], yaw: number, target: [number, number, number], secs = 12) {
  const p = new THREE.Vector3();
  const s = b.init(p) as NavAgent & Record<string, unknown>;
  s.pos.set(...pos); s.yaw = yaw; s.target.set(...target); s.retarget = 5; s.speed = 1;
  const tmp = { v: new THREE.Vector3(), fwd: new THREE.Vector3() };
  const others: THREE.Vector3[] = [s.pos];
  const dt = 1 / 60;
  const last = s.pos.clone();
  let t = 0;
  const log: string[] = [];
  for (let i = 0; i < secs * 60; i++) {
    t += dt;
    const opts = b.tick(s, dt, { t, others });
    const res = opts.skipNav ? { floorY: floorHeight(TANK_BOTTOM, s.pos.x, s.pos.z), shallowBlocked: false } : navStep(s, dt, b.nav, opts, tmp);
    b.after?.(s, dt, res, { t, others });
    if (i % 60 === 0) {
      const probeBlocked = b.nav.lookahead.map((ah) => blocked(s.pos.x + Math.cos(s.yaw) * ah, Math.min(s.pos.y, -0.3), s.pos.z - Math.sin(s.yaw) * ah, b.nav.margin, b.nav.clearance));
      log.push(`t${t.toFixed(0).padStart(3)} pos ${s.pos.x.toFixed(2)},${s.pos.y.toFixed(2)},${s.pos.z.toFixed(2)} yaw ${s.yaw.toFixed(2)} spd ${s.speed.toFixed(2)} tgt ${s.target.x.toFixed(1)},${s.target.z.toFixed(1)} stuck ${(s.stuck ?? 0).toFixed(1)} shallow ${res.shallowBlocked} ahead ${probeBlocked} floor ${floorHeight(TANK_BOTTOM, s.pos.x, s.pos.z).toFixed(2)} moved ${s.pos.distanceTo(last).toFixed(2)}`);
      last.copy(s.pos);
    }
  }
  console.log(`== ${b.species} from ${pos} yaw ${yaw}`); console.log(log.join("\n"));
}
run(dolphin as Behaviour, [-6.43, -0.25, 0.38], Math.PI, [2, -1, 3]);
run(manta as Behaviour, [0.06, -0.5, 0.85], Math.PI / 2, [-3, -1.2, -3]);
run(whaleshark as Behaviour, [6.4, -0.55, 0.75], -0.3, [4, -0.6, -2]);
