#!/usr/bin/env node
/**
 * Build a view-streamable, walkable gaussian splat scene from a 3DGS .ply.
 *
 * Output (in <outDir>):
 *   manifest.json   transform, bounds, chunk list (+ world-space AABBs), collision + spawn info
 *   c_<ix>_<iz>.spz one SPZ per spatial chunk (full detail, no LOD), loaded on demand at runtime
 *   collision.bin   Int16 voxel grid coords (i,j,k triplets) for a Rapier voxels collider
 *
 * Chunk files keep the PLY's *raw* coordinates; the runtime applies manifest.transform to the
 * parent group so Spark handles orientation (incl. spherical harmonics) itself. All bounds,
 * collision and spawn data in the manifest are in *world* space (Y up, meters, floor at y=0).
 *
 * Usage:
 *   node scripts/build-splat.mjs <input.ply> <outDir> [--scale 1.3] [--chunk 1.5] [--max-sh 3]
 *     [--min-opacity 0.02] [--voxel 0.08] [--floor auto|<y>] [--no-flip] [--spawn x,z,yawDeg]
 *
 * --spawn sets the start position (world meters, feet on the floor) and heading in degrees
 * (0 = looking toward -Z, positive turns left). Without it, the most open spot is picked.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { transcodeSpz } from '@sparkjsdev/spark';

const { values: opts, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		scale: { type: 'string', default: '1' }, // raw units -> meters
		chunk: { type: 'string', default: '1.5' }, // chunk column size in meters (XZ)
		'max-sh': { type: 'string', default: '3' }, // spherical harmonics degree to keep (0-3)
		'min-opacity': { type: 'string', default: '0.02' }, // drop nearly invisible splats
		voxel: { type: 'string', default: '0.08' }, // collision voxel size in meters
		floor: { type: 'string', default: 'auto' }, // floor height in (flipped, scaled) world units
		'no-flip': { type: 'boolean', default: false }, // input is already Y-up (not OpenCV Y-down)
		spawn: { type: 'string' } // "x,z,yawDeg" start pose in world space (default: most open spot)
	}
});

if (positionals.length < 2) {
	console.error('usage: build-splat.mjs <input.ply> <outDir> [options]');
	process.exit(1);
}
const [inputPath, outDir] = positionals;
const SCALE = Number(opts.scale);
const CHUNK = Number(opts.chunk);
const MAX_SH = Number(opts['max-sh']);
const MIN_OPACITY = Number(opts['min-opacity']);
const VOXEL = Number(opts.voxel);
const FLIP = !opts['no-flip'];

// Collision voxelization tuning (see README section in the page source for rationale)
const COL_MIN_OPACITY = 0.6; // only fairly solid splats make collision
const COL_MAX_SIZE = 0.4; // ignore huge blurry splats (m, largest axis)
const COL_THRESHOLD = 5; // opacity-weighted samples needed per voxel
const COL_MIN_CLUSTER = 30; // drop floater clusters smaller than this (voxels)
const COL_MIN_HEIGHT = 0.12; // floor is handled by a slab collider; ignore floor bumps below this
const COL_MAX_HEIGHT = 2.2; // above head height at the top of a jump: drop the ceiling + ceiling floaters
const BODY_BAND = [0.3, 1.7]; // height band that blocks a walking player (for spawn search)

const t0 = performance.now();
const log = (...a) => console.log(`[${((performance.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ---------------------------------------------------------------------------------------------
// Parse PLY
// ---------------------------------------------------------------------------------------------
const file = fs.readFileSync(inputPath);
const headerEnd = file.indexOf('end_header\n');
if (headerEnd < 0) throw new Error('not a PLY file');
const headerText = file.subarray(0, headerEnd).toString('latin1');
const dataStart = headerEnd + 'end_header\n'.length;
if (!headerText.includes('format binary_little_endian')) throw new Error('only binary_little_endian PLY supported');
const numSplats = Number(/element vertex (\d+)/.exec(headerText)?.[1]);
const props = [...headerText.matchAll(/property (\w+) (\w+)/g)].map((m) => ({ type: m[1], name: m[2] }));
if (props.some((p) => p.type !== 'float')) throw new Error('only all-float PLY properties supported');
const STRIDE = props.length; // floats per splat
const P = Object.fromEntries(props.map((p, i) => [p.name, i]));
for (const k of ['x', 'y', 'z', 'opacity', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3']) {
	if (!(k in P)) throw new Error(`PLY missing property ${k}`);
}
// copy to an aligned buffer
const data = new Float32Array(file.buffer.slice(file.byteOffset + dataStart, file.byteOffset + dataStart + numSplats * STRIDE * 4));
log(`read ${numSplats.toLocaleString()} splats, ${STRIDE} props each`);

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const ySign = FLIP ? -1 : 1;

// World-space centers (before floor offset), opacity, and largest scale
const wx = new Float32Array(numSplats), wy = new Float32Array(numSplats), wz = new Float32Array(numSplats);
const alpha = new Float32Array(numSplats), maxScale = new Float32Array(numSplats);
for (let i = 0; i < numSplats; i++) {
	const o = i * STRIDE;
	wx[i] = data[o + P.x] * SCALE;
	wy[i] = data[o + P.y] * SCALE * ySign;
	wz[i] = data[o + P.z] * SCALE * ySign;
	alpha[i] = sigmoid(data[o + P.opacity]);
	maxScale[i] = Math.exp(Math.max(data[o + P.scale_0], data[o + P.scale_1], data[o + P.scale_2])) * SCALE;
}

function quantiles(arr, mask, qs) {
	const step = Math.max(1, Math.floor(arr.length / 200000));
	const sample = [];
	for (let i = 0; i < arr.length; i += step) if (!mask || mask(i)) sample.push(arr[i]);
	sample.sort((a, b) => a - b);
	return qs.map((q) => sample[Math.min(sample.length - 1, Math.floor(q * sample.length))]);
}

// ---------------------------------------------------------------------------------------------
// Floor + bounds
// ---------------------------------------------------------------------------------------------
let floorY;
if (opts.floor === 'auto') {
	// densest 1cm slab of solid splats within the lowest quarter of the scene
	const [ylo, yq] = quantiles(wy, (i) => alpha[i] > 0.3, [0.001, 0.25]);
	const bins = new Uint32Array(Math.max(1, Math.ceil((yq - ylo) / 0.01)));
	for (let i = 0; i < numSplats; i++) {
		if (alpha[i] > 0.3 && wy[i] >= ylo && wy[i] < yq) bins[Math.floor((wy[i] - ylo) / 0.01)]++;
	}
	let best = 0;
	for (let b = 1; b < bins.length; b++) if (bins[b] > bins[best]) best = b;
	floorY = ylo + (best + 0.5) * 0.01;
} else {
	floorY = Number(opts.floor);
}
for (let i = 0; i < numSplats; i++) wy[i] -= floorY;
log(`floor at ${floorY.toFixed(3)} (world units before offset)`);

const solid = (i) => alpha[i] > 0.1;
const [x0, x1] = quantiles(wx, solid, [0.005, 0.995]);
const [y0, y1] = quantiles(wy, solid, [0.005, 0.995]);
const [z0, z1] = quantiles(wz, solid, [0.005, 0.995]);
const bounds = { min: [x0, Math.max(0, y0), z0], max: [x1, y1, z1] };
log('bounds', bounds.min.map((v) => v.toFixed(2)), bounds.max.map((v) => v.toFixed(2)));

// ---------------------------------------------------------------------------------------------
// Chunking: full-height XZ columns. Splats are assigned by center; far outliers dropped.
// ---------------------------------------------------------------------------------------------
const OUTLIER_MARGIN = 1.0;
const nx = Math.max(1, Math.ceil((x1 - x0) / CHUNK));
const nz = Math.max(1, Math.ceil((z1 - z0) / CHUNK));
const chunkOf = new Int32Array(numSplats).fill(-1);
const counts = new Uint32Array(nx * nz);
let dropped = 0;
for (let i = 0; i < numSplats; i++) {
	const out =
		alpha[i] < MIN_OPACITY ||
		wx[i] < x0 - OUTLIER_MARGIN || wx[i] > x1 + OUTLIER_MARGIN ||
		wz[i] < z0 - OUTLIER_MARGIN || wz[i] > z1 + OUTLIER_MARGIN ||
		wy[i] < y0 - OUTLIER_MARGIN || wy[i] > y1 + OUTLIER_MARGIN;
	if (out) { dropped++; continue; }
	const ix = Math.min(nx - 1, Math.max(0, Math.floor((wx[i] - x0) / CHUNK)));
	const iz = Math.min(nz - 1, Math.max(0, Math.floor((wz[i] - z0) / CHUNK)));
	chunkOf[i] = ix * nz + iz;
	counts[ix * nz + iz]++;
}
log(`grid ${nx}x${nz} chunks of ${CHUNK}m, dropped ${dropped.toLocaleString()} splats (low opacity / outliers)`);

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (/^c_\d+_\d+\.spz$/.test(f)) fs.unlinkSync(path.join(outDir, f));

// bucket indices per chunk
const offsets = new Uint32Array(nx * nz + 1);
for (let c = 0; c < nx * nz; c++) offsets[c + 1] = offsets[c] + counts[c];
const order = new Uint32Array(offsets[nx * nz]);
const fill = offsets.slice(0, nx * nz);
for (let i = 0; i < numSplats; i++) if (chunkOf[i] >= 0) order[fill[chunkOf[i]]++] = i;

const chunks = [];
let totalBytes = 0;
for (let ix = 0; ix < nx; ix++) {
	for (let iz = 0; iz < nz; iz++) {
		const c = ix * nz + iz;
		const n = counts[c];
		if (n === 0) continue;
		const ids = order.subarray(offsets[c], offsets[c + 1]);
		// world AABB including (capped) splat extents
		const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
		const body = new Float32Array(n * STRIDE);
		for (let k = 0; k < n; k++) {
			const i = ids[k];
			const r = Math.min(2 * maxScale[i], 0.3);
			mn[0] = Math.min(mn[0], wx[i] - r); mx[0] = Math.max(mx[0], wx[i] + r);
			mn[1] = Math.min(mn[1], wy[i] - r); mx[1] = Math.max(mx[1], wy[i] + r);
			mn[2] = Math.min(mn[2], wz[i] - r); mx[2] = Math.max(mx[2], wz[i] + r);
			body.set(data.subarray(i * STRIDE, (i + 1) * STRIDE), k * STRIDE);
		}
		const header = headerText.replace(/element vertex \d+/, `element vertex ${n}`) + 'end_header\n';
		const ply = new Uint8Array(header.length + body.byteLength);
		ply.set(Buffer.from(header, 'latin1'), 0);
		ply.set(new Uint8Array(body.buffer), header.length);
		const { fileBytes } = await transcodeSpz({ inputs: [{ fileBytes: ply, pathOrUrl: 'chunk.ply' }], maxSh: MAX_SH });
		const name = `c_${ix}_${iz}.spz`;
		fs.writeFileSync(path.join(outDir, name), fileBytes);
		totalBytes += fileBytes.length;
		const round = (v) => Math.round(v * 1000) / 1000;
		chunks.push({ id: name.slice(0, -4), url: name, count: n, bytes: fileBytes.length, min: mn.map(round), max: mx.map(round) });
	}
}
log(`wrote ${chunks.length} chunks, ${(totalBytes / 1e6).toFixed(1)} MB total (SH${MAX_SH})`);

// ---------------------------------------------------------------------------------------------
// Collision voxels: sample each solid splat at its center and +-1/2, 1 sigma along its axes
// (so flat wall/floor splats fill their footprint), accumulate opacity, threshold, then drop
// small floater clusters. Grid origin sits exactly on the floor (y=0).
// ---------------------------------------------------------------------------------------------
const gOrigin = [Math.floor(x0 / VOXEL) * VOXEL, 0, Math.floor(z0 / VOXEL) * VOXEL];
const gx = Math.ceil((x1 - gOrigin[0]) / VOXEL) + 1;
const gy = Math.ceil(y1 / VOXEL) + 1;
const gz = Math.ceil((z1 - gOrigin[2]) / VOXEL) + 1;
const occ = new Float32Array(gx * gy * gz);
const vidx = (i, j, k) => (i * gy + j) * gz + k;
const deposit = (x, y, z, w) => {
	const i = Math.floor((x - gOrigin[0]) / VOXEL), j = Math.floor(y / VOXEL), k = Math.floor((z - gOrigin[2]) / VOXEL);
	if (i >= 0 && i < gx && j >= 0 && j < gy && k >= 0 && k < gz) occ[vidx(i, j, k)] += w;
};
for (let s = 0; s < numSplats; s++) {
	if (alpha[s] < COL_MIN_OPACITY || maxScale[s] > COL_MAX_SIZE || chunkOf[s] < 0) continue;
	const o = s * STRIDE;
	let qw = data[o + P.rot_0], qx = data[o + P.rot_1], qy = data[o + P.rot_2], qz = data[o + P.rot_3];
	const qn = Math.hypot(qw, qx, qy, qz) || 1;
	qw /= qn; qx /= qn; qy /= qn; qz /= qn;
	// rotation matrix columns = splat local axes (raw frame)
	const axes = [
		[1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy + qw * qz), 2 * (qx * qz - qw * qy)],
		[2 * (qx * qy - qw * qz), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz + qw * qx)],
		[2 * (qx * qz + qw * qy), 2 * (qy * qz - qw * qx), 1 - 2 * (qx * qx + qy * qy)]
	];
	const w = alpha[s];
	deposit(wx[s], wy[s], wz[s], w);
	for (let a = 0; a < 3; a++) {
		const sc = Math.exp(data[o + P[`scale_${a}`]]) * SCALE;
		if (sc < VOXEL * 0.5) continue;
		const ax = axes[a][0], ay = axes[a][1] * ySign, az = axes[a][2] * ySign;
		for (const k of [-1, -0.5, 0.5, 1]) deposit(wx[s] + ax * sc * k, wy[s] + ay * sc * k, wz[s] + az * sc * k, w);
	}
}
const solidVox = new Uint8Array(gx * gy * gz);
for (let v = 0; v < occ.length; v++) solidVox[v] = occ[v] >= COL_THRESHOLD ? 1 : 0;

// connected components (26-neighborhood); remove small ones
const label = new Int32Array(gx * gy * gz).fill(-1);
const stack = new Int32Array(gx * gy * gz);
let removed = 0;
for (let start = 0; start < solidVox.length; start++) {
	if (!solidVox[start] || label[start] >= 0) continue;
	let sp = 0, members = [];
	stack[sp++] = start; label[start] = start;
	while (sp) {
		const v = stack[--sp];
		members.push(v);
		const k = v % gz, j = Math.floor(v / gz) % gy, i = Math.floor(v / (gz * gy));
		for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
			const ni = i + di, nj = j + dj, nk = k + dk;
			if (ni < 0 || nj < 0 || nk < 0 || ni >= gx || nj >= gy || nk >= gz) continue;
			const n = vidx(ni, nj, nk);
			if (solidVox[n] && label[n] < 0) { label[n] = start; stack[sp++] = n; }
		}
	}
	if (members.length < COL_MIN_CLUSTER) { for (const v of members) solidVox[v] = 0; removed += members.length; }
}

const minJ = Math.ceil(COL_MIN_HEIGHT / VOXEL);
const coords = [];
const maxJ = Math.floor(COL_MAX_HEIGHT / VOXEL); // voxel j spans [j*V, (j+1)*V)
for (let i = 0; i < gx; i++) for (let j = minJ; j < Math.min(gy, maxJ); j++) for (let k = 0; k < gz; k++) {
	if (solidVox[vidx(i, j, k)]) coords.push(i, j, k);
}
fs.writeFileSync(path.join(outDir, 'collision.bin'), Buffer.from(new Int16Array(coords).buffer));
log(`collision: ${(coords.length / 3).toLocaleString()} voxels of ${VOXEL}m (removed ${removed} floater voxels)`);

// ---------------------------------------------------------------------------------------------
// Spawn: free cell (in body band) with the most clearance, preferring the scene center
// ---------------------------------------------------------------------------------------------
const b0 = Math.floor(BODY_BAND[0] / VOXEL), b1 = Math.ceil(BODY_BAND[1] / VOXEL);
const blocked = new Uint8Array(gx * gz);
for (let i = 0; i < gx; i++) for (let k = 0; k < gz; k++) {
	for (let j = b0; j < Math.min(b1, gy); j++) if (solidVox[vidx(i, j, k)]) { blocked[i * gz + k] = 1; break; }
}
// BFS clearance from blocked cells and the grid border
const clearance = new Int32Array(gx * gz).fill(-1);
let queue = [];
for (let i = 0; i < gx; i++) for (let k = 0; k < gz; k++) {
	if (blocked[i * gz + k] || i === 0 || k === 0 || i === gx - 1 || k === gz - 1) { clearance[i * gz + k] = 0; queue.push(i * gz + k); }
}
for (let qi = 0; qi < queue.length; qi++) {
	const c = queue[qi], i = Math.floor(c / gz), k = c % gz;
	for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
		const ni = i + di, nk = k + dk;
		if (ni < 0 || nk < 0 || ni >= gx || nk >= gz || clearance[ni * gz + nk] >= 0) continue;
		clearance[ni * gz + nk] = clearance[c] + 1;
		queue.push(ni * gz + nk);
	}
}
const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
let bestCell = 0, bestScore = -Infinity;
for (let c = 0; c < gx * gz; c++) {
	const i = Math.floor(c / gz), k = c % gz;
	const px = gOrigin[0] + (i + 0.5) * VOXEL, pz = gOrigin[2] + (k + 0.5) * VOXEL;
	const score = Math.min(clearance[c], 10) - 0.05 * Math.hypot(px - cx, pz - cz) / VOXEL;
	if (score > bestScore) { bestScore = score; bestCell = c; }
}
let spawn, yaw;
if (opts.spawn) {
	const [sx, sz, yawDeg = 0] = opts.spawn.split(',').map(Number);
	if (![sx, sz, yawDeg].every(Number.isFinite)) throw new Error('--spawn expects x,z,yawDeg');
	spawn = [sx, 0, sz];
	yaw = (yawDeg * Math.PI) / 180;
	const ci = Math.floor((sx - gOrigin[0]) / VOXEL), ck = Math.floor((sz - gOrigin[2]) / VOXEL);
	const inside = ci >= 0 && ci < gx && ck >= 0 && ck < gz;
	if (!inside || blocked[ci * gz + ck]) console.warn(`warning: --spawn (${sx}, ${sz}) is blocked or outside the scene`);
	log(`spawn (manual) at (${sx.toFixed(2)}, ${sz.toFixed(2)}), clearance ${(inside ? clearance[ci * gz + ck] * VOXEL : 0).toFixed(2)}m`);
} else {
	const si = Math.floor(bestCell / gz), sk = bestCell % gz;
	spawn = [gOrigin[0] + (si + 0.5) * VOXEL, 0, gOrigin[2] + (sk + 0.5) * VOXEL];
	// face along the longer scene axis, toward the farther end
	yaw = x1 - x0 >= z1 - z0
		? (spawn[0] - x0 > x1 - spawn[0] ? Math.PI / 2 : -Math.PI / 2)
		: (spawn[2] - z0 > z1 - spawn[2] ? 0 : Math.PI);
	log(`spawn (auto) at (${spawn[0].toFixed(2)}, ${spawn[2].toFixed(2)}), clearance ${(clearance[bestCell] * VOXEL).toFixed(2)}m`);
}

// ---------------------------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------------------------
const r3 = (a) => a.map((v) => Math.round(v * 1000) / 1000);
const manifest = {
	version: 1,
	source: path.basename(inputPath),
	splatCount: order.length,
	maxSh: MAX_SH,
	totalBytes,
	// raw PLY coords -> world: world = position + quaternion * (scale * raw)
	transform: {
		position: [0, -floorY, 0],
		quaternion: FLIP ? [1, 0, 0, 0] : [0, 0, 0, 1], // three.js (x, y, z, w): 180 deg about X
		scale: SCALE
	},
	bounds: { min: r3(bounds.min), max: r3(bounds.max) },
	chunkSize: CHUNK,
	chunks,
	collision: {
		url: 'collision.bin',
		format: 'int16-ijk',
		voxelSize: VOXEL,
		origin: r3(gOrigin),
		count: coords.length / 3
	},
	spawn: { position: r3(spawn), yaw: Math.round(yaw * 1000) / 1000 }
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');
log(`wrote ${path.join(outDir, 'manifest.json')}`);
