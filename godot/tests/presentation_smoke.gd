extends SceneTree

const Session = preload("res://scripts/simulation/session.gd")
const ObservationClock = preload("res://scripts/presentation/observation_clock.gd")

var failures: int = 0
var checks: int = 0

func check(condition: bool, message: String) -> void:
	checks += 1
	if condition: print("UI PASS: ", message)
	else:
		failures += 1
		push_error("UI FAIL: " + message)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var scene = load("res://scenes/main.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	scene.set_process(false)
	scene.sim.paused = true
	scene.sim.advance_to(3 * scene.sim.day_seconds())
	scene.refresh_view()
	scene.quick_rain()
	scene.rain_button.pressed.emit()
	check(scene.last_result.ok and not scene.sim.world.effects.is_empty(), "Rain button calls real shared kernel")
	scene.divine_tabs.current_tab = 1
	scene.oracle_button.pressed.emit()
	check(scene.last_result.ok and scene.sim.religion.oracles.size() == 1, "Oracle button addresses real eligible Saint")
	scene.sim.advance_to(9 * scene.sim.day_seconds() + scene.sim.day_seconds() / 3)
	scene.refresh_view()
	scene.select_entity("person", scene.sim.religion.living_saints(scene.sim)[0], Vector2.ZERO)
	check(scene.inspector.text.contains("神諭壓力") and scene.sim.world.rain_bonus_harvest > 0, "Inspector exposes real decision and environmental consequence")
	var before = var_to_bytes(scene.sim.export_state())
	scene.save_world()
	scene.sim.advance_by(scene.sim.day_seconds())
	scene.load_world()
	check(var_to_bytes(scene.sim.export_state()) == before, "manual save/load buttons preserve exact state")
	var zoom_before = scene.map.zoom
	var scroll = InputEventMouseButton.new()
	scroll.button_index = MOUSE_BUTTON_WHEEL_UP
	scroll.pressed = true
	scroll.position = scene.map.size * 0.5
	scene.map._gui_input(scroll)
	check(scene.map.zoom > zoom_before, "map zoom handler")
	scene.toggle_pause()
	var before_time = scene.sim.time
	scene.sim.advance_wall(0.5)
	check(scene.sim.time > before_time, "Pause/Resume button uses shared clock")
	scene.toggle_pause()
	await check_observation(scene)
	scene.map.zoom = zoom_before
	scene.map.camera = Vector2(29, 29)
	scene.refresh_view()
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var image = root.get_texture().get_image()
	image.save_png("res://test-output/ui-preview.png")
	print("UI RESULT: ", checks, " checks, ", failures, " failures")
	quit(1 if failures > 0 else 0)

func check_observation(scene) -> void:
	var original_sim = scene.sim
	var paced = Session.new()
	var direct = Session.new()
	paced.start()
	direct.start()
	var clock = ObservationClock.new()
	clock.reset(paced)
	var event = clock.advance_wall(paced, 0.5)
	check(event.is_empty() and paced.time == 30600, "night acceleration stops at 08:00 and spends the remaining frame at daytime speed")
	direct.advance_to(paced.time)
	check(var_to_bytes(paced.export_state()) == var_to_bytes(direct.export_state()), "night pacing preserves exact kernel state and every scheduled update")
	paced.paused = true
	var before = var_to_bytes(paced.export_state())
	clock.advance_wall(paced, 10.0)
	check(var_to_bytes(paced.export_state()) == before, "manual pause also freezes the observation clock")
	paced.start()
	paced.paused = false
	clock.reset(paced)
	clock.night_skip_enabled = false
	clock.advance_wall(paced, 0.5)
	check(paced.time == 5400, "night skip can be disabled for normal nighttime observation")
	paced.start()
	paced.advance_to(71990)
	clock.night_skip_enabled = true
	clock.reset(paced)
	clock.advance_wall(paced, 30.0 / 10800.0)
	check(absi(paced.time - 72160) <= 1, "20:00 boundary accelerates only the nighttime part of a frame")

	# A real pending birth tests interruption between the coarse system intervals.
	scene.sim = Session.new()
	scene.sim.start({"initial_food_per_household": 80.0})
	scene.sim.advance_to(3 * scene.sim.day_seconds())
	var parent = scene.sim.individuals.people[0]
	parent.pregnancy_due = scene.sim.time + 3600
	parent.pregnancy_partner = parent.partner_id
	var due_time = parent.pregnancy_due
	scene.sim.speed = 16
	scene.sim.paused = false
	scene.observation_clock.reset(scene.sim)
	scene.night_event.clear()
	scene.map.selected_person = 0
	scene.map.event_people.clear()
	scene.advance_observation(0.2)
	check(scene.sim.paused and scene.sim.time == due_time, "nighttime birth interrupts even 16x exactly at the event deadline")
	check(scene.sim.individuals.births == 1 and scene.night_event.kind == "birth", "interruption observes an actual kernel birth")
	check(scene.sim.speed == 16 and scene.clock_status.text.contains("夜間事件"), "night interruption preserves the user's speed and exposes the paused state")
	var child = scene.sim.individuals.people.back()
	var unrelated = scene.sim.individuals.people[5]
	check(scene.map.person_visible(child) and not scene.map.person_visible(unrelated), "night event participants stay visible while unrelated resting residents are hidden")
	scene.select_entity("person", unrelated.id, Vector2.ZERO)
	check(scene.map.person_visible(unrelated) and scene.inspector.text.contains("休息"), "a resting resident remains available through the resident inspector")
	scene.select_entity("overview", 0, Vector2.ZERO)
	scene.show_event(scene.night_event.id)
	scene.refresh_view()
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute("res://test-output")
	root.get_texture().get_image().save_png("res://test-output/ui-night.png")
	scene.toggle_pause()
	scene.advance_observation(0.001)
	check(not scene.sim.paused and scene.sim.time > due_time and scene.map.event_people.is_empty(), "Continue resumes without replaying the same nighttime event")
	scene.sim.paused = true
	scene.sim.advance_to(3 * scene.sim.day_seconds() + scene.sim.day_seconds() / 3)
	scene.select_entity("overview", 0, Vector2.ZERO)
	before = var_to_bytes(scene.sim.export_state())
	scene.refresh_view()
	var visible = 0
	for person in scene.view.individuals.people: visible += int(scene.map.person_visible(person))
	check(scene.map.daytime and visible > 0, "daytime view shows actual active residents")
	check(var_to_bytes(scene.sim.export_state()) == before, "visibility and refresh do not change authoritative residents or resources")

	scene.sim = Session.new()
	scene.sim.start()
	scene.sim.paused = true
	scene.observation_clock.reset(scene.sim)
	scene.toggle_pause()
	scene.advance_observation(5.0)
	scene.refresh_view()
	check(not scene.sim.paused and scene.sim.settlements.towns.size() == 1 and is_equal_approx(scene.observation_clock.grace_remaining, 5.0), "Resume grants ten real seconds without pausing for the actual founding event")
	check(scene.clock_status.text.contains("緩衝 5 秒"), "resume grace is exposed in the observation status")
	scene.toggle_pause()
	var grace_before = scene.observation_clock.grace_remaining
	scene.advance_observation(20.0)
	check(scene.observation_clock.grace_remaining == grace_before, "manual pause does not consume resume grace")
	scene.toggle_pause()
	check(scene.observation_clock.grace_remaining == 10.0, "another manual Resume grants a fresh grace period")
	scene.advance_observation(10.0)
	# No held events are replayed when the window ends. The next genuinely new
	# nighttime event may interrupt again; existing history stays available.
	check(scene.observation_clock.grace_remaining == 0.0 and not scene.sim.paused, "grace expires by real elapsed time without replaying suppressed events")
	parent = scene.sim.individuals.people[0]
	parent.pregnancy_due = scene.sim.time - scene.sim.time % scene.sim.day_seconds() + 21 * scene.sim.day_seconds() / 24
	parent.pregnancy_partner = parent.partner_id
	scene.advance_observation(4.0)
	check(scene.sim.paused and scene.night_event.kind == "birth", "a genuinely new nighttime birth pauses again after resume grace")
	var has_founding = false
	for entry in scene.sim.history.events: has_founding = has_founding or entry.kind == "settlement"
	check(has_founding, "events observed during grace remain in History")

	scene.sim = original_sim
	scene.observation_clock.reset(scene.sim)
	scene.night_event.clear()
	scene.map.event_people.clear()
	scene.fill_people()
	scene.select_entity("person", scene.sim.religion.living_saints(scene.sim)[0], Vector2.ZERO)
	scene.show_result({"ok": true, "reason": "白天觀察活動居民；夜間重大事件會暫停供查看。"})
