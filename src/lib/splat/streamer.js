import { Box3, Frustum, Matrix4, Vector3 } from 'three';
import { SplatMesh } from '@sparkjsdev/spark';

/**
 * @typedef {{ id: string, url: string, count: number, bytes: number, min: number[], max: number[] }} ChunkInfo
 * @typedef {'idle' | 'loading' | 'loaded' | 'error'} ChunkState
 * @typedef {{ info: ChunkInfo, box: Box3, center: Vector3, state: ChunkState, mesh: SplatMesh | null, fade: number, score: number }} Chunk
 */

const FADE_SECONDS = 0.6;
const REPRIORITIZE_MS = 150;

/**
 * Streams full-detail splat chunks (no LOD) in the order the viewer needs them:
 * the chunk you're standing in first, then chunks in the view frustum by distance and
 * angle from the view direction, then everything else. Chunks are never unloaded.
 */
export class ChunkStreamer {
	/**
	 * @param {object} opts
	 * @param {URL} opts.baseUrl directory containing the manifest
	 * @param {{ chunks: ChunkInfo[] }} opts.manifest
	 * @param {import('three').Object3D} opts.parent group carrying manifest.transform
	 * @param {number} [opts.maxConcurrent]
	 * @param {() => void} [opts.onChange]
	 */
	constructor({ baseUrl, manifest, parent, maxConcurrent = 3, onChange }) {
		this.baseUrl = baseUrl;
		this.parent = parent;
		this.maxConcurrent = maxConcurrent;
		this.onChange = onChange ?? (() => {});
		/** @type {Chunk[]} */
		this.chunks = manifest.chunks.map((info) => {
			const box = new Box3(new Vector3(...info.min), new Vector3(...info.max));
			return { info, box, center: box.getCenter(new Vector3()), state: 'idle', mesh: null, fade: 0, score: 0 };
		});
		this.totalBytes = this.chunks.reduce((s, c) => s + c.info.bytes, 0);
		this.loadedBytes = 0;
		this.disposed = false;
		/** @type {{ id: string, t: number, done?: number }[]} load timeline (for debugging) */
		this.log = [];
		this._lastPrioritize = -Infinity;
		this._frustum = new Frustum();
		this._m = new Matrix4();
		this._fwd = new Vector3();
		this._dir = new Vector3();
	}

	get loadedCount() {
		return this.chunks.filter((c) => c.state === 'loaded').length;
	}

	get loadingCount() {
		return this.chunks.filter((c) => c.state === 'loading').length;
	}

	/**
	 * Call every frame.
	 * @param {import('three').PerspectiveCamera} camera
	 * @param {number} delta seconds
	 */
	update(camera, delta) {
		if (this.disposed) return;
		for (const c of this.chunks) {
			if (c.mesh && c.fade < 1) {
				c.fade = Math.min(1, c.fade + delta / FADE_SECONDS);
				c.mesh.opacity = c.fade * c.fade * (3 - 2 * c.fade); // smoothstep
			}
		}
		const now = performance.now();
		if (now - this._lastPrioritize < REPRIORITIZE_MS) return;
		this._lastPrioritize = now;

		let loading = this.loadingCount;
		if (loading >= this.maxConcurrent) return;
		const idle = this.chunks.filter((c) => c.state === 'idle');
		if (idle.length === 0) return;

		camera.updateMatrixWorld();
		this._frustum.setFromProjectionMatrix(this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
		camera.getWorldDirection(this._fwd);
		const eye = camera.position;
		for (const c of idle) c.score = this.score(c, eye);
		idle.sort((a, b) => a.score - b.score);
		for (const c of idle) {
			if (loading >= this.maxConcurrent) break;
			this.load(c);
			loading++;
		}
	}

	/**
	 * Lower = load sooner.
	 * @param {Chunk} c
	 * @param {Vector3} eye
	 */
	score(c, eye) {
		const dist = c.box.distanceToPoint(eye);
		if (dist === 0) return -1; // we're inside it
		const visible = this._frustum.intersectsBox(c.box);
		const cos = this._dir.subVectors(c.center, eye).normalize().dot(this._fwd);
		// visible chunks first by distance; off-screen chunks penalized, more so if behind us
		return (visible ? dist : 3 + dist * 2) + (1 - cos) * 1.5;
	}

	/** @param {Chunk} c */
	load(c) {
		c.state = 'loading';
		/** @type {{ id: string, t: number, done?: number }} */
		const entry = { id: c.info.id, t: performance.now() };
		this.log.push(entry);
		this.onChange();
		const mesh = new SplatMesh({ url: new URL(c.info.url, this.baseUrl).href, raycastable: false });
		mesh.opacity = 0;
		mesh.initialized
			.then(() => {
				if (this.disposed) return mesh.dispose();
				c.mesh = mesh;
				c.state = 'loaded';
				entry.done = performance.now();
				this._lastPrioritize = -Infinity; // a slot freed up: pick the next chunk on the next frame
				this.loadedBytes += c.info.bytes;
				this.parent.add(mesh);
				this.onChange();
			})
			.catch((err) => {
				console.error(`failed to load splat chunk ${c.info.id}`, err);
				c.state = 'error';
				this._lastPrioritize = -Infinity;
				this.onChange();
			});
	}

	dispose() {
		this.disposed = true;
		for (const c of this.chunks) {
			if (c.mesh) {
				this.parent.remove(c.mesh);
				c.mesh.dispose();
				c.mesh = null;
			}
		}
	}
}
