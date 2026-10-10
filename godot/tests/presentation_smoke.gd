extends SceneTree

const Session = preload("res://scripts/simulation/session.gd")
const ObservationClock = preload("res://scripts/presentation/observation_clock.gd")
const MiraclePicker = preload("res://scripts/presentation/miracle_picker.gd")

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

func click_map(scene, position: Vector2) -> void:
	var click = InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	click.position = position
	scene.map._gui_input(click)

func choose_area_and_cast(scene, center: Vector2 = Vector2(24, 26)) -> void:
	scene.miracle_button.pressed.emit()
	click_map(scene, scene.map.world_to_screen(center))

func run() -> void:
	var scene = load("res://scenes/main.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	scene.set_process(false)
	scene.sim.paused = true
	scene.sim.advance_to(3 * scene.sim.day_seconds())
	scene.refresh_view()
	scene.quick_rain()
	choose_area_and_cast(scene)
	check(scene.last_result.ok and not scene.sim.world.effects.is_empty(), "Miracle area click calls real shared Rain kernel")
	scene.divine_tabs.current_tab = 1
	scene.oracle_button.pressed.emit()
	check(scene.last_result.ok and scene.sim.religion.oracles.size() == 1, "Oracle button addresses real eligible Saint")
	scene.sim.advance_to(9 * scene.sim.day_seconds() + scene.sim.day_seconds() / 3)
	scene.refresh_view()
	scene.select_entity("person", scene.sim.religion.living_saints(scene.sim)[0], Vector2.ZERO)
	scene.person_section.select(1)
	scene.update_inspector()
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
	await check_inspection_and_targeting(scene)
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

func check_inspection_and_targeting(scene) -> void:
	var original_sim = scene.sim
	var original_state = var_to_bytes(original_sim.export_state())
	scene.sim = Session.new()
	scene.sim.start()
	scene.sim.advance_to(3 * scene.sim.day_seconds() + scene.sim.day_seconds() / 3)
	scene.sim.paused = true
	scene.observation_clock.reset(scene.sim)
	scene.night_event.clear()
	scene.map.event_people.clear()
	scene.map.camera = Vector2(29, 29)
	scene.map.zoom = 1.15
	scene.saints_in_menu = [-999]
	scene.prayers_in_menu = [-999]
	scene.last_feed_id = 0
	scene.cancel_miracle_targeting(false)
	scene.fill_people()
	scene.refresh_view()
	root.size = Vector2i(1280, 720)
	scene.select_entity("person", 1, Vector2.ZERO)
	await process_frame
	await process_frame
	await process_frame
	check(scene.person_section.selected == 0 and scene.inspector_pages.page == 0 and scene.inspector.get_parsed_text().contains("虔誠") and scene.inspector.get_parsed_text().contains("農耕"), "resident's faith and basic abilities are visible immediately at 1280x720")
	var basic_text = scene.inspector_pages.content
	var world_before_inspection = var_to_bytes(scene.sim.export_state())
	scene.person_section.select(1)
	scene.person_section.item_selected.emit(1)
	check(scene.inspector_pages.content.contains("此刻") and scene.inspector_pages.content.contains("決策原因"), "live activity and decision details remain available in their own view")
	scene.refresh_view()
	check(scene.person_section.selected == 1, "periodic refresh preserves the user's chosen resident view")
	scene.select_entity("person", 2, Vector2.ZERO)
	check(scene.person_section.selected == 0 and not scene.inspector_pages.content.contains("決策原因"), "selecting another resident returns to basic attributes and faith")
	scene.select_entity("person", 1, Vector2.ZERO)
	check(scene.inspector_pages.content == basic_text and var_to_bytes(scene.sim.export_state()) == world_before_inspection, "resident presentation does not mutate attributes, faith or decisions")
	var bubbles = scene.map.prayer_bubbles()
	var real_pending_bubbles = not bubbles.is_empty()
	for bubble in bubbles:
		real_pending_bubbles = real_pending_bubbles and scene.sim.religion.prayers[bubble.household_id].status == "pending"
	check(real_pending_bubbles, "visible prayer bubbles all belong to real pending household requests")
	if not bubbles.is_empty():
		var bubble = bubbles[0]
		var old_target = scene.map.target
		click_map(scene, bubble.rect.get_center())
		var prayer = scene.sim.religion.prayers[bubble.household_id]
		check(scene.selected_kind == "prayer" and scene.selected_id == bubble.household_id and scene.inspector_pages.content.contains("原始祈求 #%d" % prayer.event_id), "clicking a prayer bubble opens that request and its real history link")
		check(scene.map.target == old_target and scene.miracles.active_id.is_empty() and scene.sim.command_log.is_empty(), "reading a prayer neither chooses a Miracle area nor sends a command")
		scene.prayer_select.select(0)
		scene.focus_prayer()
		check(scene.selected_kind == "prayer" and scene.map.target == old_target and scene.map.targeting_id.is_empty(), "prayer list navigation also remains independent of casting")
		scene.map.zoom = 1.7
		scene.map.camera += Vector2(1, 2)
		bubbles = scene.map.prayer_bubbles()
		if not bubbles.is_empty():
			bubble = bubbles.back()
			click_map(scene, bubble.rect.get_center())
			check(scene.selected_id == bubble.household_id and bubble.rect.size == Vector2(26, 19), "prayer drawing and hit regions remain aligned after zoom and pan")
		scene.map.zoom = 1.15
		scene.map.camera = Vector2(29, 29)
		scene.select_entity("prayer", prayer.household_id, Vector2.ZERO)
		scene.refresh_view()
		await process_frame
		await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://test-output/ui-prayer.png")
	check(var_to_bytes(scene.sim.export_state()) == world_before_inspection, "prayer bubbles, navigation and camera changes preserve the complete world state")
	var target_before = scene.map.target
	click_map(scene, scene.map.size * 0.5)
	check(scene.map.target == target_before and scene.miracles.active_id.is_empty(), "ordinary map inspection does not change a Miracle center")
	scene.map.target = Vector2(-1, -1)
	scene.quick_rain()
	check(scene.miracle_select.item_count == 1 and scene.miracles.selected_id == "rain" and scene.miracles.active_id.is_empty(), "MVP catalog contains only Rain; quick settings do not begin targeting")
	scene.miracle_button.pressed.emit()
	check(scene.miracles.active_id == "rain" and scene.map.targeting_id == "rain" and not scene.map.target_hovered, "chosen Miracle enters targeting without adopting the previous map location")
	var motion = InputEventMouseMotion.new()
	motion.position = scene.map.world_to_screen(Vector2(-1, -1))
	scene.map._gui_input(motion)
	check(scene.miracle_preview.text.contains("超出河谷") and not scene.map.target_valid and not scene.miracle_button.disabled, "invalid hover shows authoritative local rejection while cancellation remains available")
	click_map(scene, motion.position)
	check(not scene.last_result.ok and scene.miracles.active_id == "rain" and scene.sim.command_log.is_empty() and var_to_bytes(scene.sim.export_state()) == world_before_inspection, "invalid area click preserves targeting and spends no DP or command")
	var cancel = InputEventKey.new()
	cancel.keycode = KEY_ESCAPE
	cancel.pressed = true
	scene._unhandled_key_input(cancel)
	check(scene.miracles.active_id.is_empty() and scene.map.targeting_id.is_empty() and var_to_bytes(scene.sim.export_state()) == world_before_inspection, "Escape cancels targeting without changing simulation state")
	scene.miracle_button.pressed.emit()
	motion.position = scene.map.world_to_screen(Vector2(60, 60))
	scene.map._gui_input(motion)
	click_map(scene, motion.position)
	check(not scene.last_result.ok and scene.last_result.reason.contains("缺少信仰臨在") and scene.miracles.active_id == "rain" and scene.sim.command_log.is_empty(), "local faith is checked only at the newly chosen area and rejects remote casting")
	await process_frame
	await process_frame
	check(controls_fit(scene, Rect2(Vector2.ZERO, Vector2(root.size))), "local rejection and the cancel control remain visible at 1280x720")
	motion.position = scene.map.world_to_screen(Vector2(24, 26))
	scene.map._gui_input(motion)
	check(scene.map.target_valid and scene.miracle_preview.text.contains("臨在 "), "hover previews the currently chosen area's real faith and radius")
	await process_frame
	await process_frame
	await process_frame
	check(root.size == Vector2i(1280, 720) and controls_fit(scene, Rect2(Vector2.ZERO, Vector2(root.size))), "armed targeting preview and cancellation fit the minimum viewport")
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://test-output/ui-targeting.png")
	var projected_dp = scene.sim.divine.projected_dp(scene.sim)
	var expected_cost = scene.miracles.preview(scene.sim, scene.map.target).cost
	click_map(scene, motion.position)
	check(scene.last_result.ok and scene.sim.command_log.size() == 1 and is_equal_approx(scene.sim.divine.dp, projected_dp - expected_cost) and scene.sim.world.effects.size() == 1, "valid area click spends the quoted DP once and creates one real Rain")
	check(scene.map.targeting_id.is_empty() and scene.miracles.active_id.is_empty() and scene.miracle_button.disabled, "casting exits generic targeting and enforces the existing cooldown")
	scene.issue_oracle()
	scene.sim.advance_to(9 * scene.sim.day_seconds() + scene.sim.day_seconds() / 3)
	scene.refresh_view()
	var fulfilled_bubble = false
	for bubble in scene.map.prayer_bubbles(): fulfilled_bubble = fulfilled_bubble or scene.sim.religion.prayers[bubble.household_id].status == "fulfilled"
	check(scene.sim.religion.fulfilled_count > 0 and not fulfilled_bubble, "real Rain and Oracle need recovery removes fulfilled prayer bubbles")
	# Routing fixture only: no extra Miracle is registered in the game or kernel.
	var picker = MiraclePicker.new()
	var available = func(_sim, _command): return {"ok": true, "cost": 1.0, "reason": "fixture"}
	picker.configure([
		{"id": "first", "parameters": func(): return {"radius": 2}, "availability": available, "evaluate": available},
		{"id": "second", "parameters": func(): return {"radius": 4}, "availability": available, "evaluate": available}], ["first", "second"])
	picker.begin(scene.sim)
	picker.select("second")
	check(picker.active_id.is_empty() and picker.selected_id == "second", "switching Miracle definitions cancels the prior area's operation")
	picker.begin(scene.sim)
	var routed = picker.command_at(Vector2(10, 12))
	check(routed.type == "second" and routed.radius == 4 and routed.x == 10 and routed.y == 12, "generic targeting routes the selected Miracle's own ID and parameters")
	scene.sim = original_sim
	root.size = Vector2i(1440, 900)
	scene.cancel_miracle_targeting(false)
	scene.observation_clock.reset(scene.sim)
	scene.saints_in_menu = [-999]
	scene.prayers_in_menu = [-999]
	scene.last_feed_id = 0
	scene.fill_people()
	scene.select_entity("person", scene.sim.religion.living_saints(scene.sim)[0], Vector2.ZERO)
	scene.refresh_view()
	check(var_to_bytes(original_sim.export_state()) == original_state, "inspection and targeting tests preserve the original world")

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
	choose_area_and_cast(scene)
	check(scene.last_result.ok and scene.miracle_button.disabled and scene.miracles.active_id.is_empty() and scene.map.targeting_id.is_empty(), "successful Rain greys out targeting and clears the selected area mode")
	var shortcut = InputEventKey.new()
	shortcut.keycode = KEY_1
	shortcut.pressed = true
	scene._unhandled_key_input(shortcut)
	check(scene.map.targeting_id.is_empty() and not scene.last_result.ok, "shortcut cannot arm a cooling-down Miracle")
	var cooldown_label = scene.miracle_preview.text
	scene.advance_observation(20.0)
	scene.refresh_view()
	check(scene.miracle_preview.text == cooldown_label, "paused UI keeps the simulated cooldown constant")
	scene.sim.advance_to(scene.sim.divine.skills.rain.cooldown_until - 1)
	scene.refresh_view()
	check(scene.miracle_button.disabled, "Rain remains unavailable one simulated second before cooldown expiry")
	scene.sim.advance_by(1)
	scene.refresh_view()
	check(not scene.miracle_button.disabled, "Rain targeting recovers at the exact simulation cooldown deadline")
	var saint = scene.sim.religion.living_saints(scene.sim)[0]
	scene.sim.religion.saints[saint].quota = 0
	scene.refresh_view()
	check(scene.oracle_button.disabled and scene.oracle_summary.text.contains("配額不足"), "Oracle uses authoritative quota evaluation and a distinct visible reason")
	scene.sim.divine.dp = 0.0
	scene.sim.divine.last_accrual = scene.sim.time
	scene.update_miracle_preview()
	check(scene.miracle_button.disabled and scene.miracle_preview.text.contains("神力不足"), "insufficient DP blocks targeting with the actual reason")
	scene.map.target = Vector2(-1, -1)
	scene.update_miracle_preview()
	check(scene.miracle_preview.text.contains("尚未選擇區域") and scene.miracle_preview.text.contains("神力不足"), "idle availability uses global resources without evaluating a stale map target")
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
	check(scene.status_label.text.is_empty() and scene.miracle_button.disabled and scene.miracle_preview.text.contains("神力不足"), "transient command feedback expires while the current blocking reason stays visible")
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
	scene.person_section.select(1)
	scene.update_inspector()
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
