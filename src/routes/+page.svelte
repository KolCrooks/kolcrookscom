<script>
	import Cursor from '$lib/cursor.svelte';
	import Scene from '$lib/scene.svelte';
    import { base } from '$app/paths';

	import { Canvas } from '@threlte/core';

	let add_fun = $state(() => console.log('nothin'));

	let audio;

	let images = [
		'IMG_0975.JPG',
		'IMG_0976.JPG',
		'IMG_0977.JPG',
		'IMG_0978.JPG',
		'IMG_0979.JPG',
		'IMG_0980.JPG',
		'IMG_0981.JPG',
		'IMG_0982.JPG',
		'IMG_0983.JPG',
		'IMG_0984.JPG',
		'IMG_0985.JPG',
		'IMG_0986.JPG',
		'IMG_0988.JPG',
		'IMG_0989.JPG',
		'IMG_0990.JPG',
		'IMG_0991.JPG',
		'IMG_0992.JPG',
		'IMG_0993.JPG',
		'IMG_0994.JPG'
	];

    function seededRandom(seed) {
        let offset = 1;
        const x = Math.sin(seed + offset) * 10000;
        return x - Math.floor(x);
    }
</script>
<div class="relative z-0">
    <div class="text-4xl m-1">Welcome to Kol's website</div>
    <hr class="cs-hr" />
    <div>
        <div class="p-1 flex flex-wrap">
            <img src="{base}/pics/farm_colony/IMG_0987.JPG" alt="farm colony" />
            <div class="bg-black/50 grow min-w-fit ml-1 mr-1">
                <div class="text-3xl m-2">
                    Recent Activities
                    <div>
                        <button
                        class="cs-btn float-end z-20 relative cursor-none"
                        onclick={() => {
                            audio.pause();
                            audio.currentTime = 0;
                            audio.play();
                            add_fun();
                        }}>Click me</button
                        >
                        <form action="{base}/blog">
                            <button
                                class="cs-btn float-end z-20 relative cursor-none mx-2"
                                type="submit"
                            >
                                Blog
                            </button>
                        </form>
                    </div>
                </div>
                <hr class="cs-hr" />
                <div class="text-xl">
                    <ul class="list-disc">
                        <li class="ml-6">I made this</li>
                        <li class="ml-6">Working on a cool camera</li>
                        <li class="ml-6">idk probably something else</li>
                        <li class="ml-6">I <span class="line-through">might make</span> made a blog</li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="p-1 bg-(--bg) w-fit">
            <div class="p-1 z-20 relative">
                <div class="text-3xl m-2">Job stuff</div>
                <hr class="cs-hr" />
                <div class="text-xl">
                    <ul class="list-disc">
                        <li class="ml-6">I'm currently at <a class="hover:underline text-blue-100" href="https://www.datadoghq.com/">Datadog</a></li>
                        <li class="ml-6 "><a class="hover:underline text-blue-100" href="https://github.com/kolcrooks">Heres my github</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
    
    
    <Cursor />
    <div class="canvas">
        <Canvas>
            <Scene bind:add_fun />
        </Canvas>
    </div>
</div>
<audio src="{base}/sound/button.wav" bind:this={audio}></audio>
<div class="absolute overflow-x-clip top-0 left-0 w-full h-full flex flex-wrap justify-center items-center -z-10">
    {#each images as image, index}
        <img 
            src={`${base}/pics/farm_colony/${image}`} 
            alt={`farm colony ${index}`} 
            class="absolute select-none"
            style={`top: ${seededRandom(index) * 200}%; left: ${seededRandom(index + images.length) * 100}%; transform: translate(-50%, -50%);`} 
        />
    {/each}
</div>

<style lang="scss">
    @import "../cs16.min.css";

	.canvas {
		width: 100%;
		height: 100vh;
		position: absolute;
		top: 0;
		left: 0;
		z-index: 10;
	}
</style>
