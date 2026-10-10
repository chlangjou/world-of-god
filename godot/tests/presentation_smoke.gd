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
	check(scene.inspector_pages.content.contains("神諭壓力") and scene.sim.world.rain_bonus_harvest > 0, "Inspector exposes real decision and environmental consequence")
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
	await check_ui_guide(scene)
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

func controls_fit(node: Node, bounds: Rect2) -> bool:
	if node is Window: return true
	if node is Control:
		if not node.is_visible_in_tree(): return true
		if not bounds.grow(1.0).encloses(node.get_global_rect()):
			print("UI BOUNDS: ", node.get_path(), " ", node.get_global_rect(), " viewport ", bounds)
			return false
	for child in node.get_children():
		if not controls_fit(child, bounds): return false
	return true

func pages_fit(pager) -> bool:
	var original_page = pager.page
	for index in pager.pages.size():
		pager.page = index
		pager.display_page()
		if pager.body.get_content_height() > pager.body.size.y + 1.0: return false
	pager.page = original_page
	pager.display_page()
	return not pager.body.scroll_active

func check_ui_guide(scene) -> void:
	var original_sim = scene.sim
	var original_result = scene.last_result.duplicate(true)
	var original_state = var_to_bytes(original_sim.export_state())
	scene.sim = Session.new()
	scene.sim.start({"population": 120})
	scene.sim.advance_to(3 * scene.sim.day_seconds())
	scene.sim.paused = true
	scene.observation_clock.reset(scene.sim)
	scene.night_event.clear()
	scene.fill_people()
	scene.refresh_view()
	scene.quick_rain()
	scene.rain_button.pressed.emit()
	check(scene.last_result.ok and scene.rain_button.disabled and scene.rain_target_toggle.disabled and not scene.map.rain_mode, "successful Rain greys out cast and targeting and clears armed state")
	var shortcut = InputEventKey.new()
	shortcut.keycode = KEY_1
	shortcut.pressed = true
	scene._unhandled_key_input(shortcut)
	check(not scene.map.rain_mode and not scene.last_result.ok, "Rain shortcut cannot arm a cooling-down Miracle")
	var cooldown_label = scene.rain_button.text
	scene.advance_observation(20.0)
	scene.refresh_view()
	check(scene.rain_button.text == cooldown_label, "paused UI keeps the simulated cooldown constant")
	scene.sim.advance_to(scene.sim.divine.skills.rain.cooldown_until - 1)
	scene.refresh_view()
	check(scene.rain_button.disabled, "Rain remains unavailable one simulated second before cooldown expiry")
	scene.sim.advance_by(1)
	scene.refresh_view()
	check(not scene.rain_button.disabled and not scene.rain_target_toggle.disabled, "Rain targeting and cast recover at the exact simulation cooldown deadline")
	var saint = scene.sim.religion.living_saints(scene.sim)[0]
	scene.sim.religion.saints[saint].quota = 0
	scene.refresh_view()
	check(scene.oracle_button.disabled and scene.oracle_summary.text.contains("配額不足"), "Oracle uses authoritative quota evaluation and a distinct visible reason")
	scene.sim.divine.dp = 0.0
	scene.sim.divine.last_accrual = scene.sim.time
	scene.update_rain_preview()
	check(scene.rain_button.disabled and scene.rain_preview.text.contains("神力不足"), "insufficient DP blocks both Rain controls with the actual reason")
	scene.map.target = Vector2(-1, -1)
	scene.update_rain_preview()
	check(scene.rain_button.disabled and scene.rain_preview.text.contains("超出河谷"), "invalid target displays the simulator's actual capability reason")
	scene.map.target = Vector2(24, 26)
	scene.refresh_view()
	var fixture_state = var_to_bytes(scene.sim.export_state())
	var all_people = {}
	for group in ceili(float(scene.sim.individuals.people.size()) / scene.PEOPLE_PER_PAGE):
		scene.people_page = group
		scene.fill_people()
		for index in range(1, scene.person_select.item_count): all_people[scene.person_select.get_item_id(index)] = true
	check(all_people.size() == 120 and scene.person_select.item_count <= 9, "all 120 real residents remain selectable through bounded non-scrolling groups")
	scene.select_entity("person", 120, Vector2.ZERO)
	var stress_lines: Array[String] = []
	for index in 150: stress_lines.append("[url=event:%d]測試文字 #%d[/url] · 這是介面分頁測試，不寫入世界歷史。" % [index, index])
	scene.history_pages.set_content("\n".join(stress_lines), true)
	for resolution in [Vector2i(1280, 720), Vector2i(1366, 768), Vector2i(1920, 1080)]:
		root.size = resolution
		for tab in 3:
			scene.divine_tabs.current_tab = tab
			await process_frame
			await process_frame
			await process_frame
			check(controls_fit(scene, Rect2(Vector2.ZERO, Vector2(root.size))) and scene.map.size.x >= 260 and scene.map.size.y >= 210, "fixed viewport keeps map and tab %d controls visible at %s" % [tab, resolution])
		check(pages_fit(scene.inspector_pages) and pages_fit(scene.history_pages), "all inspection and 150-entry history pages fit without vertical scrolling at %s" % resolution)
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://test-output/ui-%dx%d.png" % [resolution.x, resolution.y])
	var ids: Array[int] = []
	for value in 300: ids.append(value)
	var raw_context = JSON.stringify(ids)
	scene.inspector_pages.set_content(raw_context, false, true)
	await process_frame
	await process_frame
	var recovered = ""
	for index in scene.inspector_pages.pages.size():
		scene.inspector_pages.page = index
		scene.inspector_pages.display_page()
		recovered += scene.inspector.get_parsed_text()
	check(recovered.replace("\n", "").replace(" ", "") == raw_context.replace(" ", "") and pages_fit(scene.inspector_pages), "long bracketed context retains every ID across fitted pages")
	scene.history_pages.page = scene.history_pages.pages.size() - 1
	scene.history_pages.previous.pressed.emit()
	var selected_history_page = scene.history_pages.page
	scene.history_pages.reflow()
	check(scene.history_pages.page == selected_history_page, "history reflow preserves a user-selected older page")
	scene.show_hint("降雨說明", "雨增加土壤水分。\n食物仍需作物生長與實際收穫。\n暫停會停止模擬冷卻倒數。")
	await process_frame
	await process_frame
	check(scene.hint_dialog.visible and pages_fit(scene.hint_pages), "contextual help is available through a focusable click/keyboard dialog")
	scene.hint_dialog.hide()
	scene.advanced.visible = true
	scene.rain_settings.popup_centered(Vector2i(410, 240))
	await process_frame
	await process_frame
	check(scene.rain_settings.visible and controls_fit(scene.advanced, Rect2(Vector2.ZERO, Vector2(scene.rain_settings.size))), "all advanced Rain settings remain reachable in a discrete dialog")
	scene.rain_settings.hide()
	scene.show_result({"ok": false, "reason": "測試操作回饋"})
	scene._process(5.1)
	check(scene.status_label.text.is_empty() and scene.rain_button.disabled and scene.rain_preview.text.contains("神力不足"), "transient command feedback expires while the current blocking reason stays visible")
	check(var_to_bytes(scene.sim.export_state()) == fixture_state, "pagination, hints and resizing preserve authoritative simulation state")
	scene.sim = original_sim
	root.size = Vector2i(1440, 900)
	scene.observation_clock.reset(scene.sim)
	scene.saints_in_menu = [-999]
	scene.prayers_in_menu = [-999]
	scene.last_feed_id = 0
	scene.fill_people()
	scene.divine_tabs.current_tab = 0
	scene.select_entity("person", original_sim.religion.living_saints(original_sim)[0], Vector2.ZERO)
	scene.refresh_view()
	scene.show_result(original_result)
	check(scene.oracle_button.disabled and not scene.active_oracle().is_empty(), "same-Saint active intent lock is visible independently of Miracle cooldown")
	check(var_to_bytes(original_sim.export_state()) == original_state, "UI guide tests leave the original world unchanged")

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
	check(scene.map.person_visible(unrelated) and scene.inspector_pages.content.contains("休息"), "a resting resident remains available through the resident inspector")
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
