<script>
	/**
	 * Touch controls: a floating joystick on the left half of the screen (analog move,
	 * push to the rim to run), drag anywhere on the right half to look, plus Jump / Menu buttons.
	 *
	 * Writes into `input`, a plain mutable object the Player reads every physics tick:
	 *   moveX/moveY in [-1, 1] (strafe / forward), lookX/lookY accumulated pixels, jump flag.
	 */
	let { input, onmenu } = $props();

	const RADIUS = 56; // joystick travel in px

	/** @type {{ id: number, ox: number, oy: number, kx: number, ky: number } | null} */
	let stick = $state(null);
	/** @type {number | null} */
	let lookId = null;
	let lastX = 0;
	let lastY = 0;

	/** @param {PointerEvent} e */
	function down(e) {
		if (e.pointerType === 'mouse') return;
		e.preventDefault();
		/** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
		if (!stick && e.clientX < window.innerWidth / 2) {
			stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, kx: 0, ky: 0 };
		} else if (lookId === null) {
			lookId = e.pointerId;
			lastX = e.clientX;
			lastY = e.clientY;
		}
	}

	/** @param {PointerEvent} e */
	function move(e) {
		if (stick && e.pointerId === stick.id) {
			let dx = e.clientX - stick.ox;
			let dy = e.clientY - stick.oy;
			const len = Math.hypot(dx, dy);
			if (len > RADIUS) {
				dx *= RADIUS / len;
				dy *= RADIUS / len;
			}
			stick.kx = dx;
			stick.ky = dy;
			input.moveX = dx / RADIUS;
			input.moveY = -dy / RADIUS;
		} else if (e.pointerId === lookId) {
			input.lookX += e.clientX - lastX;
			input.lookY += e.clientY - lastY;
			lastX = e.clientX;
			lastY = e.clientY;
		}
	}

	/** @param {PointerEvent} e */
	function up(e) {
		if (stick && e.pointerId === stick.id) {
			stick = null;
			input.moveX = 0;
			input.moveY = 0;
		}
		if (e.pointerId === lookId) lookId = null;
	}

	/** @param {PointerEvent} e */
	function jump(e) {
		e.preventDefault();
		e.stopPropagation();
		input.jump = true;
	}
</script>

<div
	class="touch-layer absolute inset-0"
	role="application"
	aria-label="Touch controls: drag left side to move, right side to look"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
>
	{#if stick}
		<div class="stick-base" style:left="{stick.ox}px" style:top="{stick.oy}px">
			<div class="stick-knob" style:transform="translate({stick.kx}px, {stick.ky}px)"></div>
		</div>
	{:else}
		<!-- resting hint where the thumb usually goes -->
		<div class="stick-base ghost" style:left="96px" style:bottom="56px" style:top="auto">
			<div class="stick-knob"></div>
		</div>
	{/if}
</div>

<button class="cs-btn touch-btn jump" onpointerdown={jump}>Jump</button>
<button class="cs-btn touch-btn menu" onclick={onmenu}>Menu</button>

<style>
	.touch-layer {
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.stick-base {
		position: absolute;
		width: 112px;
		height: 112px;
		margin: -56px 0 0 -56px;
		border-radius: 50%;
		border: 2px solid rgb(255 255 255 / 0.45);
		background: rgb(0 0 0 / 0.2);
		pointer-events: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.stick-base.ghost {
		margin: 0 0 0 -56px;
		opacity: 0.35;
	}
	.stick-knob {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: rgb(255 255 255 / 0.55);
	}
	.touch-btn {
		position: absolute;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}
	.jump {
		right: 28px;
		bottom: 48px;
		font-size: 20px;
		line-height: 20px;
		padding: 18px 16px;
	}
	.menu {
		right: 8px;
		top: 8px;
	}
</style>
