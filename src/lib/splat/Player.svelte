<script>
	import { useThrelte } from '@threlte/core';
	import { usePhysicsTask, useRapier } from '@threlte/rapier';
	import { onDestroy, onMount } from 'svelte';
	import { Vector3 } from 'three';

	/**
	 * First-person walker: pointer-lock mouse look + WASD, driven by a Rapier kinematic
	 * character controller (capsule) so it collides with the baked splat voxels.
	 */
	let {
		camera,
		spawn,
		noclip = false,
		touch = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, jump: false },
		locked = $bindable(false),
		lock = $bindable(() => {})
	} = $props();

	const RADIUS = 0.2; // slim enough for this apartment's doorways
	const HALF_HEIGHT = 0.65; // cylinder half-height -> 1.7m tall capsule
	const CENTER_Y = HALF_HEIGHT + RADIUS;
	const EYE = 0.72; // eye above capsule center (~1.57m)
	const WALK = 1.8;
	const RUN = 3.6;
	const JUMP = 3.8;
	const GRAVITY = 9.81;
	const LOOK = 0.0022;
	const TOUCH_LOOK = 0.005;

	const { world, rapier } = useRapier();
	const { renderer } = useThrelte();
	const canvas = renderer.domElement;

	const spawnPos = () => ({ x: spawn.position[0], y: spawn.position[1] + CENTER_Y + 0.05, z: spawn.position[2] });

	const start = spawnPos();
	const body = world.createRigidBody(
		rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, start.y, start.z)
	);
	const collider = world.createCollider(rapier.ColliderDesc.capsule(HALF_HEIGHT, RADIUS), body);
	const controller = world.createCharacterController(0.02);
	controller.setUp({ x: 0, y: 1, z: 0 });
	controller.setSlideEnabled(true);
	controller.enableAutostep(0.3, 0.12, false);
	controller.enableSnapToGround(0.25);
	controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
	controller.setMinSlopeSlideAngle((35 * Math.PI) / 180);
	controller.setApplyImpulsesToDynamicBodies(false);

	let yaw = spawn.yaw ?? 0;
	let pitch = 0;
	let vy = 0;
	let grounded = false;
	let jumpQueuedAt = -Infinity; // buffer taps so a quick press between physics ticks still jumps
	/** @type {Set<string>} */
	const keys = new Set();

	const forward = new Vector3();
	const right = new Vector3();
	const wish = new Vector3();

	const requestLock = () => canvas.requestPointerLock?.();
	lock = requestLock;

	function onPointerLockChange() {
		locked = document.pointerLockElement === canvas;
		if (!locked) keys.clear();
	}
	/** @param {MouseEvent} e */
	function onMouseMove(e) {
		if (!locked) return;
		yaw -= e.movementX * LOOK;
		pitch = Math.max(-1.55, Math.min(1.55, pitch - e.movementY * LOOK));
	}
	/** @param {KeyboardEvent} e */
	function onKeyDown(e) {
		if (!locked) return;
		keys.add(e.code);
		if (e.code === 'Space') {
			e.preventDefault();
			if (!e.repeat) jumpQueuedAt = performance.now();
		}
	}
	/** @param {KeyboardEvent} e */
	function onKeyUp(e) {
		keys.delete(e.code);
	}
	function onBlur() {
		keys.clear();
	}

	onMount(() => {
		if (import.meta.env.DEV) /** @type {any} */ (window).__home = {
				body,
				camera,
				get grounded() { return grounded; },
				/** dev/test helper: teleport (feet position) and aim */
				teleport(/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ y = yaw, p = 0) {
					body.setTranslation({ x, y: CENTER_Y + 0.05, z }, true);
					yaw = y;
					pitch = p;
				}
			};
		document.addEventListener('pointerlockchange', onPointerLockChange);
		document.addEventListener('mousemove', onMouseMove);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('blur', onBlur);
		canvas.addEventListener('click', requestLock);
	});

	onDestroy(() => {
		document.removeEventListener('pointerlockchange', onPointerLockChange);
		document.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('keyup', onKeyUp);
		window.removeEventListener('blur', onBlur);
		canvas.removeEventListener('click', requestLock);
		if (document.pointerLockElement === canvas) document.exitPointerLock();
		world.removeCharacterController(controller);
		world.removeRigidBody(body);
	});

	/** @param {string} pos @param {string} neg */
	const axis = (pos, neg) => (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);

	usePhysicsTask((delta) => {
		const dt = Math.min(delta, 1 / 20);

		// touch: consume accumulated look drag and queued jump
		if (touch.lookX || touch.lookY) {
			yaw -= touch.lookX * TOUCH_LOOK;
			pitch = Math.max(-1.55, Math.min(1.55, pitch - touch.lookY * TOUCH_LOOK));
			touch.lookX = touch.lookY = 0;
		}
		if (touch.jump) {
			jumpQueuedAt = performance.now();
			touch.jump = false;
		}

		const fwd = axis('KeyW', 'KeyS') + axis('ArrowUp', 'ArrowDown') + touch.moveY;
		const strafe = axis('KeyD', 'KeyA') + axis('ArrowRight', 'ArrowLeft') + touch.moveX;
		const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(touch.moveX, touch.moveY) > 0.95;
		const speed = run ? RUN : WALK;
		const pos = body.translation();
		let next;

		if (noclip) {
			// fly along the view direction, ignoring collision
			camera.getWorldDirection(forward);
			right.crossVectors(forward, camera.up).normalize();
			wish.set(0, 0, 0).addScaledVector(forward, fwd).addScaledVector(right, strafe);
			wish.y += axis('Space', 'KeyQ');
			if (wish.lengthSq() > 1) wish.normalize();
			wish.multiplyScalar(speed * dt);
			next = { x: pos.x + wish.x, y: pos.y + wish.y, z: pos.z + wish.z };
			vy = 0;
		} else {
			forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
			right.set(Math.cos(yaw), 0, -Math.sin(yaw));
			wish.set(0, 0, 0).addScaledVector(forward, fwd).addScaledVector(right, strafe);
			if (wish.lengthSq() > 1) wish.normalize();
			wish.multiplyScalar(speed * dt);

			if (grounded) {
				const jump = performance.now() - jumpQueuedAt < 200;
				if (jump) jumpQueuedAt = -Infinity;
				vy = jump ? JUMP : -0.5; // small push keeps us snapped to the floor
			} else {
				vy -= GRAVITY * dt;
			}
			controller.computeColliderMovement(collider, { x: wish.x, y: vy * dt, z: wish.z });
			const moved = controller.computedMovement();
			grounded = controller.computedGrounded();
			if (vy > 0 && moved.y < vy * dt * 0.5) vy = 0; // bonked our head
			next = { x: pos.x + moved.x, y: pos.y + moved.y, z: pos.z + moved.z };
			if (next.y < -5) next = spawnPos(); // fell out of the world
		}

		body.setNextKinematicTranslation(next);
		camera.position.set(next.x, next.y + EYE, next.z);
		camera.rotation.set(pitch, yaw, 0, 'YXZ');
	});
</script>
