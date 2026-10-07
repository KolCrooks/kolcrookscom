<script>
	import { T } from '@threlte/core';
	import { useRapier } from '@threlte/rapier';
	import { onDestroy } from 'svelte';
	import { BoxGeometry, InstancedMesh, Matrix4, MeshBasicMaterial } from 'three';

	/**
	 * Static collision for the splat scene:
	 * - one Rapier voxels collider built from the baked voxel grid (walls, furniture)
	 * - a floor slab at y=0 (floor splats are too thin/noisy to rely on)
	 * - invisible perimeter walls so you can't walk out of the captured area
	 */
	let { manifest, voxels, show = false } = $props();

	const { world, rapier } = useRapier();
	const { voxelSize: v, origin } = manifest.collision;
	const { min, max } = manifest.bounds;

	/** @type {import('@dimforge/rapier3d-compat').Collider[]} */
	const colliders = [];

	if (voxels.length > 0) {
		const desc = rapier.ColliderDesc.voxels(Int32Array.from(voxels), { x: v, y: v, z: v }).setTranslation(
			origin[0],
			origin[1],
			origin[2]
		);
		colliders.push(world.createCollider(desc));
	}

	const pad = 0.5;
	const cx = (min[0] + max[0]) / 2;
	const cz = (min[2] + max[2]) / 2;
	const hx = (max[0] - min[0]) / 2 + pad;
	const hz = (max[2] - min[2]) / 2 + pad;
	const wallH = Math.max(3, max[1] + 1);
	/** @type {[number, number, number, number, number, number][]} half extents + center */
	const boxes = [
		[hx, 0.5, hz, cx, -0.5, cz], // floor
		[pad, wallH, hz, min[0] - pad, wallH, cz], // -x wall
		[pad, wallH, hz, max[0] + pad, wallH, cz], // +x wall
		[hx, wallH, pad, cx, wallH, min[2] - pad], // -z wall
		[hx, wallH, pad, cx, wallH, max[2] + pad] // +z wall
	];
	for (const [x, y, z, px, py, pz] of boxes) {
		colliders.push(world.createCollider(rapier.ColliderDesc.cuboid(x, y, z).setTranslation(px, py, pz)));
	}

	onDestroy(() => {
		for (const c of colliders) world.removeCollider(c, false);
		debugMesh.geometry.dispose();
		debugMesh.material.dispose();
	});

	// Debug view: one instanced box per voxel
	const count = voxels.length / 3;
	const debugMesh = new InstancedMesh(
		new BoxGeometry(v * 0.92, v * 0.92, v * 0.92),
		new MeshBasicMaterial({ color: '#ff3b6b', transparent: true, opacity: 0.35, depthWrite: false }),
		Math.max(1, count)
	);
	const m = new Matrix4();
	for (let i = 0; i < count; i++) {
		m.makeTranslation(
			origin[0] + (voxels[i * 3] + 0.5) * v,
			origin[1] + (voxels[i * 3 + 1] + 0.5) * v,
			origin[2] + (voxels[i * 3 + 2] + 0.5) * v
		);
		debugMesh.setMatrixAt(i, m);
	}
	debugMesh.count = count;
	debugMesh.frustumCulled = false;
	debugMesh.renderOrder = 10; // after the splats (which don't write depth)
</script>

<T is={debugMesh} visible={show} />
