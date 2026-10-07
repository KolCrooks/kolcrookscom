<script>
	import { T, useTask, useThrelte } from '@threlte/core';
	import { World } from '@threlte/rapier';
	import { SparkRenderer } from '@sparkjsdev/spark';
	import { onDestroy } from 'svelte';
	import { Box3Helper, Color, Group } from 'three';
	import { ChunkStreamer } from './streamer.js';
	import Collision from './Collision.svelte';
	import Player from './Player.svelte';

	let {
		manifest,
		baseUrl,
		voxels,
		showCollision = false,
		showChunks = false,
		noclip = false,
		locked = $bindable(false),
		lock = $bindable(() => {}),
		stats = $bindable({ loaded: 0, loading: 0, total: 0, loadedBytes: 0, totalBytes: 0 })
	} = $props();

	const { renderer, scene } = useThrelte();

	/** @type {import('three').PerspectiveCamera | undefined} */
	let camera = $state();

	// Spark draws every SplatMesh in the scene in one globally depth-sorted pass,
	// so independently loaded chunks blend together seamlessly.
	const spark = new SparkRenderer({ renderer });
	scene.add(spark);

	// Chunks are stored in raw capture coordinates; this group maps them to world space.
	const splats = new Group();
	splats.position.fromArray(manifest.transform.position);
	splats.quaternion.fromArray(manifest.transform.quaternion);
	splats.scale.setScalar(manifest.transform.scale);
	scene.add(splats);

	// Chunk bounds debug view, colored by load state
	const STATE_COLORS = { idle: '#555555', loading: '#ffd23f', loaded: '#3bff8a', error: '#ff3b3b' };
	const chunkBoxes = new Group();

	const streamer = new ChunkStreamer({
		baseUrl,
		manifest,
		parent: splats,
		onChange: () => {
			stats = {
				loaded: streamer.loadedCount,
				loading: streamer.loadingCount,
				total: streamer.chunks.length,
				loadedBytes: streamer.loadedBytes,
				totalBytes: streamer.totalBytes
			};
			streamer.chunks.forEach((c, i) => {
				const helper = /** @type {Box3Helper | undefined} */ (chunkBoxes.children[i]);
				/** @type {import('three').LineBasicMaterial | undefined} */ (helper?.material)?.color.set(STATE_COLORS[c.state]);
			});
		}
	});
	for (const c of streamer.chunks) chunkBoxes.add(new Box3Helper(c.box, new Color(STATE_COLORS.idle)));
	stats = { loaded: 0, loading: 0, total: streamer.chunks.length, loadedBytes: 0, totalBytes: streamer.totalBytes };

	if (import.meta.env.DEV) /** @type {any} */ (window).__streamer = streamer;

	useTask((delta) => {
		if (camera) streamer.update(camera, delta);
	});

	onDestroy(() => {
		streamer.dispose();
		scene.remove(splats, spark);
		spark.dispose();
		for (const b of chunkBoxes.children) /** @type {Box3Helper} */ (b).dispose();
	});
</script>

<T.PerspectiveCamera
	makeDefault
	bind:ref={camera}
	fov={75}
	near={0.03}
	far={80}
	oncreate={(cam) => {
		// start at the spawn so the very first chunk requests are the right ones
		const [x, y, z] = manifest.spawn.position;
		cam.position.set(x, y + 1.57, z);
		cam.rotation.set(0, manifest.spawn.yaw, 0, 'YXZ');
	}}
/>

<T is={chunkBoxes} visible={showChunks} />

<World gravity={[0, -9.81, 0]}>
	<Collision {manifest} {voxels} show={showCollision} />
	{#if camera}
		<Player {camera} spawn={manifest.spawn} {noclip} bind:locked bind:lock />
	{/if}
</World>
