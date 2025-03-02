<div class="container mx-auto my-8 max-w-2xl">
    <h1 class="text-3xl font-bold mb-3 text-left">Kol's Blog Posts</h1>
    <a href="{base}/" class="text-blue-600 hover:underline text-xl mb-4 block">← Back to home</a>
    <form
        action="https://buttondown.com/api/emails/embed-subscribe/kol"
        method="post"
        target="popupwindow"
        onsubmit={() => window.open('https://buttondown.com/kol', 'popupwindow')}
        class="embeddable-buttondown-form border-2 border-gray-700 p-4 rounded mb-8"
    >
        <label for="bd-email" class="block text-xl mb-2">Subscribe to blog updates</label>
        <div class="flex gap-2">
            <input 
                type="email" 
                name="email" 
                id="bd-email"
                placeholder="your@email.com"
                class="border-2 border-gray-700 px-3 py-2 rounded grow"
                required
                pattern={"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"}
                title="Please enter a valid email address"
            />
            <input 
                type="submit" 
                value="Subscribe" 
                class="border-2 border-gray-700 px-3 py-2 rounded cursor-pointer"
            />
        </div>
    </form>
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
    import { base } from '$app/paths';
    let posts = [
        { title: 'This Weeks Music #1', slug: 'this-weeks-music-1', date: '02/26/2025' },
    ];
</script>
