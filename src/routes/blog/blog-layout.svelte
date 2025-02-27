<div class="container my-8 min-w-full px-5">
    <h1 class="text-3xl font-bold text-left">Kol's Blog Posts</h1>
    <a href="/blog" class="text-blue-600 hover:underline text-lg mb-4 block">← Back to all posts</a>
    <ul class="space-y-4 mx-auto">
        <slot />
    </ul>
</div>


<script context="module">
    import h1 from '$lib/blog/h1.svelte';
    import h2 from '$lib/blog/h2.svelte';
    import h3 from '$lib/blog/h3.svelte';
    import h4 from '$lib/blog/h4.svelte';
    import blockquote from '$lib/blog/quoteblock.svelte';

    export { h1, h2, h3, h4, blockquote };
</script>