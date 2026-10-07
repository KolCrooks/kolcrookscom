<script>
	import { Canvas } from '@threlte/core';
	import { asset, resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { NoToneMapping, WebGLRenderer } from 'three';
	import SplatScene from '#lib/splat/SplatScene.svelte';
	import TouchControls from '#lib/splat/TouchControls.svelte';

	/** @type {{ manifest: any, baseUrl: URL, voxels: Int16Array } | null} */
	let scene = $state(null);
	let error = $state('');

	let locked = $state(false);
	let lock = $state(() => {});
	let stats = $state({ loaded: 0, loading: 0, total: 0, loadedBytes: 0, totalBytes: 0 });
	let showCollision = $state(false);
	let showChunks = $state(false);
	let noclip = $state(false);

	// Touch devices have no pointer lock: "touch mode" shows on-screen controls instead.
	let isTouch = $state(false);
	let touchMode = $state(false);
	// plain (non-reactive) object mutated by TouchControls and read by the Player every tick
	const touchInput = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, jump: false };
	let playing = $derived(locked || touchMode);

	/** @param {MouseEvent} e */
	function start(e) {
		const pointerType = /** @type {PointerEvent} */ (e).pointerType;
		const viaTouch = pointerType ? pointerType !== 'mouse' : isTouch;
		if (viaTouch) {
			touchMode = true;
			document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
		} else {
			lock();
		}
	}

	function exitTouchMode() {
		touchMode = false;
		Object.assign(touchInput, { moveX: 0, moveY: 0, lookX: 0, lookY: 0, jump: false });
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
	}

	const mb = (/** @type {number} */ b) => (b / 1e6).toFixed(1);

	onMount(async () => {
		isTouch = matchMedia('(pointer: coarse)').matches;
		try {
			const manifestUrl = new URL(asset('splats/room/manifest.json'), location.href);
			const manifest = await (await fetch(manifestUrl)).json();
			const baseUrl = new URL('.', manifestUrl);
			const res = await fetch(new URL(manifest.collision.url, baseUrl));
			const voxels = new Int16Array(await res.arrayBuffer());
			scene = { manifest, baseUrl, voxels };
		} catch (e) {
			console.error(e);
			error = 'Failed to load the room.';
		}
	});

	/** @param {KeyboardEvent} e */
	function onKey(e) {
		if (e.repeat) return;
		if (e.code === 'KeyC') showCollision = !showCollision;
		if (e.code === 'KeyB') showChunks = !showChunks;
		if (e.code === 'KeyN') noclip = !noclip;
	}
</script>

<svelte:window onkeydown={onKey} />

<svelte:head>
	<title>Room · Kol Crooks</title>
	<link rel="stylesheet" href={asset('cs16.min.css')} media="all" />
</svelte:head>

<div class="fixed inset-0 overscroll-none bg-black select-none">
	{#if scene}
		<Canvas
			renderMode="always"
			toneMapping={NoToneMapping}
			dpr={[1, 1.5]}
			createRenderer={(canvas) => new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })}
		>
			<SplatScene
				manifest={scene.manifest}
				baseUrl={scene.baseUrl}
				voxels={scene.voxels}
				{showCollision}
				{showChunks}
				{noclip}
				touch={touchInput}
				bind:locked
				bind:lock
				bind:stats
			/>
		</Canvas>
	{/if}

	<!-- HUD -->
	<div class="pointer-events-none absolute top-2 left-2 text-sm text-white/80 drop-shadow">
		{#if stats.total}
			<div>
				chunks {stats.loaded}/{stats.total}
				{#if stats.loading}<span class="text-yellow-300">(+{stats.loading} loading)</span>{/if}
				· {mb(stats.loadedBytes)}/{mb(stats.totalBytes)} MB
			</div>
		{/if}
		<div class="text-white/50" class:hidden={isTouch}>
			[C] collision {showCollision ? 'on' : 'off'} · [B] chunks {showChunks ? 'on' : 'off'} · [N] noclip
			{noclip ? 'on' : 'off'}
		</div>
	</div>

	{#if playing}
		<div class="pointer-events-none absolute top-1/2 left-1/2 h-1 w-1 -translate-1/2 rounded-full bg-white/70"></div>
	{/if}
	{#if touchMode}
		<TouchControls input={touchInput} onmenu={exitTouchMode} />
	{:else if !locked}
		<div class="absolute inset-0 flex items-center justify-center bg-black/40">
			<div class="panel max-w-md p-4">
				<div class="mb-2 text-3xl">Kol's room</div>
				<hr class="cs-hr" />
				{#if error}
					<p class="my-3 text-red-300">{error}</p>
				{:else if !scene}
					<p class="my-3">Loading…</p>
				{:else}
					<p class="my-3">
						A gaussian splat that streams in chunk by chunk, starting with whatever you're looking at.
					</p>
					{#if isTouch}
						<ul class="mb-3 list-disc pl-6 text-sm">
							<li>Left thumb: move (push to the edge to run)</li>
							<li>Right thumb: drag to look around</li>
							<li>Jump button to jump · Menu to come back here</li>
							<li>Landscape works best</li>
						</ul>
					{:else}
						<ul class="mb-3 list-disc pl-6 text-sm">
							<li>Mouse: look around</li>
							<li>WASD / arrows: walk · Shift: run · Space: jump</li>
							<li>N: noclip (Space/Q up/down) · C: show collision · B: show chunks</li>
							<li>Esc: release the mouse</li>
						</ul>
					{/if}
					<div class="cs-progress-bar mb-3">
						<div class="bars" style:width="{stats.total ? (100 * stats.loaded) / stats.total : 0}%"></div>
					</div>
					<button class="cs-btn" onclick={start}>{isTouch ? 'Tap' : 'Click'} to explore</button>
				{/if}
				<a class="cs-btn ml-2 inline-block" href={resolve('')}>Back home</a>
			</div>
		</div>
	{/if}
</div>

<style>
	.panel {
		background-color: var(--bg);
		border: 1px solid;
		border-color: var(--border-light) var(--border-dark) var(--border-dark) var(--border-light);
		color: var(--text);
	}
</style>
