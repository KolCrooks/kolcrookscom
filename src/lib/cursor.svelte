<script lang="ts">
	import { onMount } from 'svelte';

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

    
	onMount(() => {
        let last_used = 0;
		const handleMouseMove = (event: MouseEvent) => {
			cursorImg.style.left = `${event.clientX}px`;
			cursorImg.style.top = `${event.clientY}px`;

			// angle from bottom right corner to top left of ak
			const angle =
				(Math.atan2(window.innerHeight - event.clientY, window.innerWidth - event.clientX) * 180) /
				Math.PI * 0.1;

			akGun.style.transform = `skew(-${angle}deg)`;
		};

		const handleMouseDown = (event: MouseEvent) => {
            if (!(event.target as HTMLElement).closest('.canvas')) {
                return;
            }
            last_used++;
            let i = last_used % akSounds.length;
            last_used = i;
			akSounds[i].pause();
			akSounds[i].currentTime = 0.1;
			akSounds[i].play();
		};

		window.addEventListener('mousedown', handleMouseDown);

		window.addEventListener('mousemove', handleMouseMove);

		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mousedown', handleMouseDown);
		};
	});
</script>

<div class="follow-cursor" bind:this={cursorImg}>
	<img src="/cursor.png" alt="" />
</div>

<img src="/pics/V_ak47.webp" bind:this={akGun} class="ak" alt="ak" />

{#each n_sounds as i}
    <audio src={`/sound/ak_sound.mp3`} volume={0.4} bind:this={akSounds[i]}></audio>
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

	.ak {
		position: fixed;
		bottom: 0;
		right: 0;
		width: 30%;
		transform: translate(30%, 30%);
		transform-origin: 50% 50%;
		pointer-events: none;
        user-select: none;
		z-index: 30;
	}
</style>