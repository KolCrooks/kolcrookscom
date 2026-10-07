<script>
	import { useThrelte } from '@threlte/core';
	import { usePhysicsTask, useRapier } from '@threlte/rapier';
	import { onDestroy, onMount } from 'svelte';
	import { Vector3 } from 'three';

	/**
	 * First-person walker: pointer-lock mouse look + WASD, driven by a Rapier kinematic
	 * character controller (capsule) so it collides with the baked splat voxels.
	 * The rigid body sits at the feet; the capsule collider is offset above it, so crouching
	 * just shrinks the capsule while the feet stay planted.
	 */
	let {
		camera,
		spawn,
		noclip = false,
		touch = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, jump: false, crouch: false },
		locked = $bindable(false),
		lock = $bindable(() => {})
	} = $props();

	const RADIUS = 0.01; // slim enough for this apartment's doorways
	const STAND_HEIGHT = 1.7;
	const CROUCH_HEIGHT = 1.0;
	const EYE_HEIGHT = 1.17; // eye above the floor when standing
	const CROUCH_EYE_HEIGHT = EYE_HEIGHT - 0.5;
	const EYE_SMOOTHING = 12; // 1/s, how fast the eye follows crouch/stand
	const WALK = 1.8;
	const RUN = 1.8;
	const CROUCH_WALK = 0.9;
	const GRAVITY = 9.81;
	const JUMP_HEIGHT = 0.45; // the ceiling is only ~0.6m above a standing head
	const JUMP = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
	const LOOK = 0.0022;
	const TOUCH_LOOK = 0.005;
	const SKIN = 0.02; // spawn/teleport slightly above the floor

	const halfHeight = (/** @type {number} */ h) => h / 2 - RADIUS;

	const { world, rapier } = useRapier();
	const { renderer } = useThrelte();
	const canvas = renderer.domElement;

	const spawnPos = () => ({ x: spawn.position[0], y: spawn.position[1] + SKIN, z: spawn.position[2] });

	const start = spawnPos();
	const body = world.createRigidBody(
		rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, start.y, start.z)
	);
	const collider = world.createCollider(
		rapier.ColliderDesc.capsule(halfHeight(STAND_HEIGHT), RADIUS).setTranslation(0, STAND_HEIGHT / 2, 0),
		body
	);
	const standingShape = new rapier.Capsule(halfHeight(STAND_HEIGHT), RADIUS);
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
	let crouched = false;
	let eye = EYE_HEIGHT;
	let jumpQueuedAt = -Infinity; // buffer taps so a quick press between physics ticks still jumps
	/** @type {Set<string>} */
	const keys = new Set();

	const forward = new Vector3();
	const right = new Vector3();
	const wish = new Vector3();

	const requestLock = () => canvas.requestPointerLock?.();
	lock = requestLock;

	/** @param {number} h */
	function setCapsule(h) {
		collider.setHalfHeight(halfHeight(h));
		collider.setTranslationWrtParent({ x: 0, y: h / 2, z: 0 });
	}

	/** Is there room to stand up with feet at `feet`? */
	function canStand(/** @type {{ x: number, y: number, z: number }} */ feet) {
		const center = { x: feet.x, y: feet.y + STAND_HEIGHT / 2 + 0.01, z: feet.z };
		return !world.intersectionWithShape(center, { x: 0, y: 0, z: 0, w: 1 }, standingShape, undefined, undefined, collider, body);
	}

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
		if (import.meta.env.DEV)
			/** @type {any} */ (window).__home = {
				body,
				camera,
				get grounded() {
					return grounded;
				},
				get crouched() {
					return crouched;
				},
				/** dev/test helper: teleport (feet position) and aim */
				teleport(/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ y = yaw, p = 0) {
					body.setTranslation({ x, y: SKIN, z }, true);
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

		const pos = body.translation();

		// crouch: shrink immediately, only stand back up if there's headroom
		const wantCrouch = !noclip && (keys.has('KeyC') || !!touch.crouch);
		if (wantCrouch && !crouched) {
			crouched = true;
			setCapsule(CROUCH_HEIGHT);
		} else if (!wantCrouch && crouched && (noclip || canStand(pos))) {
			crouched = false;
			setCapsule(STAND_HEIGHT);
		}

		const fwd = axis('KeyW', 'KeyS') + axis('ArrowUp', 'ArrowDown') + touch.moveY;
		const strafe = axis('KeyD', 'KeyA') + axis('ArrowRight', 'ArrowLeft') + touch.moveX;
		const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(touch.moveX, touch.moveY) > 0.95;
		const speed = crouched ? CROUCH_WALK : run ? RUN : WALK;
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

			// Voxel walls are bumpy: while rising along one, Rapier can report "grounded" from
			// grazing a ledge. Only trust grounded when not moving up, or it cancels the jump.
			const onGround = grounded && vy <= 0;
			if (onGround) {
				const jump = !crouched && performance.now() - jumpQueuedAt < 200;
				if (jump) jumpQueuedAt = -Infinity;
				vy = jump ? JUMP : -0.5; // small push keeps us snapped to the floor
			} else {
				vy -= GRAVITY * dt;
			}
			// autostep only on the ground; mid-air it pops us up onto wall bumps
			if (onGround) controller.enableAutostep(0.3, 0.12, false);
			else controller.disableAutostep();
			controller.computeColliderMovement(collider, { x: wish.x, y: vy * dt, z: wish.z });
			const moved = controller.computedMovement();
			grounded = controller.computedGrounded();
			if (vy > 0) {
				// only stop rising if we actually hit a downward-facing surface (a ceiling)
				for (let i = 0; i < controller.numComputedCollisions(); i++) {
					const hit = controller.computedCollision(i);
					if (hit && hit.normal1.y < -0.5) {
						vy = 0;
						break;
					}
				}
			}
			next = { x: pos.x + moved.x, y: pos.y + moved.y, z: pos.z + moved.z };
			if (next.y < -5) next = spawnPos(); // fell out of the world
		}

		body.setNextKinematicTranslation(next);
		const targetEye = crouched ? CROUCH_EYE_HEIGHT : EYE_HEIGHT;
		eye += (targetEye - eye) * Math.min(1, dt * EYE_SMOOTHING);
		camera.position.set(next.x, next.y + eye, next.z);
		camera.rotation.set(pitch, yaw, 0, 'YXZ');
	});
</script>
