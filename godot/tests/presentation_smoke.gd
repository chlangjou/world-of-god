extends SceneTree

var failures: int = 0

func check(condition: bool, message: String) -> void:
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
	scene.map.zoom = zoom_before
	scene.map.camera = Vector2(29, 29)
	scene.refresh_view()
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var image = root.get_texture().get_image()
	image.save_png("res://test-output/ui-preview.png")
	print("UI RESULT: ", failures, " failures")
	quit(1 if failures > 0 else 0)
