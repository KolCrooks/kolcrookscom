<div class="container mx-auto my-8 max-w-2xl">
    <h1 class="text-3xl font-bold mb-3 text-left">Kol's Blog Posts</h1>
    <a href="/" class="text-blue-600 hover:underline text-xl mb-4 block">← Back to home</a>
    <ul class="space-y-4">
        {#each posts as post}
            <li class="text-left flex items-center justify-between">
                <a href="blog/{post.slug}" class="text-blue-600 hover:underline text-lg">{post.title}</a>
                <span class="text-gray-500 text-sm">{post.date}</span>
            </li>
        {/each}
    </ul>
</div>

<script>
    let posts = [
        { title: 'This Weeks Music #1', slug: 'this-weeks-music-1', date: '02/26/2025' },
    ];
</script>
