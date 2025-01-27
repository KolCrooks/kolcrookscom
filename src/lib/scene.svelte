<script>
	import Crate from '$lib/crate.svelte';
	import Barrel from '$lib/barrel.svelte';
	import Ground from '$lib/ground.svelte';
	import { T } from '@threlte/core';
	import { usePhysicsTask, useRapier, World } from '@threlte/rapier';
	import { AudioListener } from '@threlte/extras';

	let { add_fun = $bindable() } = $props();

	let crates = $state([
        { id: 0, pos: [0, 10, 0] }
    ]);
	let barrels = $state([]);
	let ids = $state(0);
	add_fun = () => {
		ids += 1;
		let new_obj = { id: ids, pos: [Math.random(), 10, Math.random()] };
		if (Math.random() > 0.5) {
			crates = [...crates, new_obj];
		} else {
			barrels = [...barrels, new_obj];
		}
	};
</script>

<T.PerspectiveCamera
	makeDefault
	position={[10, 10, 10]}
	oncreate={(ref) => {
		ref.lookAt(0, 0, 0);
	}}
>
	<AudioListener />
</T.PerspectiveCamera>
<!-- <T.AmbientLight /> -->
<T.DirectionalLight position={[10, 10, 0]} />
<World>
	{#each crates as crate}
		<Crate scale={[3, 3, 3]} position={crate.pos} />
	{/each}
	{#each barrels as barrel}
		<Barrel scale={[1, 1, 1]} position={barrel.pos} on_done={()=> {
            console.log(barrels);
            barrels = barrels.filter((b) => b.id !== barrel.id);
        }} />
	{/each}
	<Ground />
</World>
