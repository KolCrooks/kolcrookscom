<script lang="ts">
	import { onMount } from 'svelte';
    import { base } from '$app/paths';

	let cursorImg: HTMLImageElement;

	let akGun: HTMLImageElement;
	let akSounds = $state(
        [
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
        ]);
    let n_sounds = [0,1,2,3,4,5];



    let pos = $state({x: 0, y: 0});
    let offset = $state(0);
    let offset_rounded = $derived(Math.round(offset));
    let ak_angle = $state(0);
    let show_flash = $state(0);

    $effect(() => {
        setInterval(() => {
            offset *= 0.9;
            if (offset < 0.5) {
                offset = 0;
            }
            if (show_flash > 0) {
                show_flash--;
            }
            
        }, 10);
    });

    
	onMount(() => {
        let last_used = 0;
		const handleMouseMove = (event: MouseEvent) => {
			pos = { x: event.clientX, y: event.clientY };
            ak_angle = (pos.x / window.innerWidth * 20 - 20) * -1;
		};


		const handleMouseDown = (event: MouseEvent) => {
            if (!(event.target as HTMLElement).closest('.canvas')) {
                return;
            }
            show_flash = 10;
            last_used++;
            let i = last_used % akSounds.length;
            last_used = i;
			akSounds[i].pause();
			akSounds[i].currentTime = 0.1;
			akSounds[i].play();
            offset += 10;
		};

		window.addEventListener('mousedown', handleMouseDown);

		window.addEventListener('mousemove', handleMouseMove);

		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mousedown', handleMouseDown);
		};
	});
</script>

<div class="follow-cursor" style="top: {pos.y-offset_rounded}px; left: {pos.x}px" bind:this={cursorImg}>
	<img src="{base}/cursor.png" alt="" />
</div>
<div class="ak" style="transform: skew({ak_angle}deg)">
    <img class="relative ak-flash" style={show_flash ? "" : "display: none"} src="{base}/pics/muzzle-flash.webp" alt="ak-flash" />
    <img class="relative" src="{base}/pics/V_ak47.webp" alt="ak" />
</div>

{#each n_sounds as i}
    <audio src="{base}/sound/ak_sound.mp3" volume={0.3} bind:this={akSounds[i]}></audio>
{/each}

<style>
    :root {
        cursor: none;
    }
	.follow-cursor {
		position: fixed;
		pointer-events: none;
		z-index: 1000;
		transform: translate(-50%, -50%);
		width: 3rem;
        user-select: none;
	}

    .ak-flash {
        transform: translate(-33%,59%);
    }

	.ak {
		position: fixed;
		bottom: 0;
		right: 0;
		width: 30%;
		transform-origin: 50% 50%;
		pointer-events: none;
        user-select: none;
		z-index: 30;
	}
</style>