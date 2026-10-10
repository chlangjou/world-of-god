extends Control

signal selected(kind: String, entity_id: int, cell: Vector2)
signal target_changed(center: Vector2)

var view: Dictionary = {}
var camera = Vector2(29, 29)
var zoom: float = 1.15
var tile_size: float = 16.0
var layer: int = 0
var target = Vector2(24, 26)
var rain_radius: float = 9.0
var rain_mode: bool = false
var selected_person: int = 0
var dragging: bool = false
var map_texture: ImageTexture
var font: Font
var hover_cell = Vector2(-1, -1)

func _ready() -> void:
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	font = get_theme_default_font()

func set_snapshot(data: Dictionary) -> void:
	view = data
	rebuild_texture()
	queue_redraw()

func rebuild_texture() -> void:
	if view.is_empty(): return
	var n = view.world.size
	var map_image = Image.create(n, n, false, Image.FORMAT_RGB8)
	for cell in view.world.cells:
		var color: Color
		if cell.terrain == "water": color = Color("345b69")
		elif layer == 1: color = Color("6e5741").lerp(Color("69b2a6"), cell.moisture)
		elif layer == 2: color = Color("303f36").lerp(Color("d7b971"), clampf(cell.crops / 4.0, 0, 1))
		elif cell.terrain == "forest": color = Color("344b40")
		elif cell.terrain == "hill": color = Color("5d6256")
		else: color = Color("66715a").lerp(Color("465f47"), cell.soil * 0.65 + cell.moisture * 0.2)
		map_image.set_pixel(cell.x, cell.y, color)
	map_texture = ImageTexture.create_from_image(map_image)

func world_to_screen(point: Vector2) -> Vector2:
	return (point - camera) * tile_size * zoom + size * 0.5

func screen_to_world(point: Vector2) -> Vector2:
	return (point - size * 0.5) / (tile_size * zoom) + camera

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("14282e"))
	if view.is_empty() or not map_texture: return
	var origin = world_to_screen(Vector2.ZERO)
	var scale_value = tile_size * zoom
	var n = view.world.size
	draw_texture_rect(map_texture, Rect2(origin, Vector2.ONE * n * scale_value), false)
	# Visual markers only; the kernel owns all people/resources/structures.
	for cell in view.world.cells:
		var point = world_to_screen(Vector2(cell.x + 0.5, cell.y + 0.5))
		if not Rect2(Vector2(-20, -20), size + Vector2(40, 40)).has_point(point): continue
		if layer == 0 and cell.terrain == "forest":
			draw_line(point + Vector2(0, 2) * zoom, point + Vector2(0, 5) * zoom, Color("263b30"), 2.0 * zoom)
			draw_colored_polygon(PackedVector2Array([point + Vector2(-5, 2) * zoom, point + Vector2(0, -6) * zoom, point + Vector2(5, 2) * zoom]), Color("294337"))
		elif cell.terrain == "water" and (cell.x + cell.y) % 3 == 0:
			draw_line(point + Vector2(-4, 0) * zoom, point + Vector2(4, 0) * zoom, Color("558393"), 1.0)
		elif layer == 0 and cell.crops > 1.0 and cell.terrain == "grass":
			draw_line(point + Vector2(-2, 2), point + Vector2(-2, -2), Color("bdad73"), 1)
			draw_line(point + Vector2(2, 2), point + Vector2(2, -3), Color("bdad73"), 1)
	for home in view.households.homes:
		var point = world_to_screen(Vector2(home.x, home.y))
		if home.dwelling_id == 0:
			draw_arc(point, 8 * zoom, 0, TAU, 16, Color(0.9, 0.83, 0.67, 0.5), 1)
	for town in view.settlements.towns:
		var center = world_to_screen(Vector2(town.x, town.y))
		draw_arc(center, 7.0 * scale_value, 0, TAU, 80, Color(0.88, 0.78, 0.56, 0.2), 1)
		for building in town.structures:
			var point = world_to_screen(Vector2(building.x, building.y))
			draw_rect(Rect2(point + Vector2(-6, -3) * zoom, Vector2(12, 10) * zoom), Color("b6a687"))
			draw_colored_polygon(PackedVector2Array([point + Vector2(-8, -3) * zoom, point + Vector2(0, -10) * zoom, point + Vector2(8, -3) * zoom]), Color("805d44") if building.kind == "housing" else Color("535f5b"))
			draw_rect(Rect2(point + Vector2(-1, 2) * zoom, Vector2(3, 5) * zoom), Color("55483b"))
		if not town.project.is_empty():
			draw_rect(Rect2(center + Vector2(-9, -7), Vector2(18, 14)), Color("d8bf86"), false, 1)
			draw_line(center + Vector2(-8, 11), center + Vector2(-8 + 16 * town.project.work / town.project.required_work, 11), Color("dfc48b"), 3)
		draw_string(font, center + Vector2(-20, -30), town.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color("efe4c7"))
	for p in view.individuals.people:
		if not p.alive: continue
		var point = world_to_screen(Vector2(p.x, p.y))
		var color = Color("e5d7ae") if p.age >= 16 else Color("b5c1a1")
		if p.hunger > 30: color = Color("e89572")
		if view.religion.saints.has(p.id):
			draw_arc(point, 8.0 * zoom, 0, TAU, 20, Color("e5c37c"), 1.5)
		if p.id == selected_person: draw_circle(point, 9.0 * zoom, Color(0.85, 0.98, 0.94, 0.3))
		draw_circle(point + Vector2(0, 2) * zoom, 3.5 * zoom, Color(0, 0, 0, 0.25))
		draw_circle(point, (3.2 if p.age >= 16 else 2.3) * zoom, color)
		if p.activity == "farm": draw_line(point + Vector2(4, 3) * zoom, point + Vector2(7, -3) * zoom, Color("e1c180"), 1)
	for effect in view.world.effects:
		var center = world_to_screen(Vector2(effect.x, effect.y))
		draw_circle(center, effect.radius * scale_value, Color(0.45, 0.8, 0.86, 0.10))
		draw_arc(center, effect.radius * scale_value, 0, TAU, 100, Color("8ec7d0"), 1.5)
		for drop in 26:
			var angle = float(drop) * 2.39996
			var offset = Vector2(cos(angle), sin(angle)) * sqrt(float(drop) / 26) * effect.radius * scale_value
			var point = center + offset
			draw_line(point, point + Vector2(-2, 7), Color(0.64, 0.88, 0.92, 0.65), 1)
	if rain_mode:
		var center = world_to_screen(target)
		draw_circle(center, rain_radius * scale_value, Color(0.47, 0.87, 0.84, 0.08))
		draw_arc(center, rain_radius * scale_value, 0, TAU, 100, Color("a6d8cd"), 2)
		draw_line(center - Vector2(7, 0), center + Vector2(7, 0), Color("e8f2df"), 1)
		draw_line(center - Vector2(0, 7), center + Vector2(0, 7), Color("e8f2df"), 1)
	if hover_cell.x >= 0:
		var point = world_to_screen(hover_cell.floor())
		draw_rect(Rect2(point, Vector2.ONE * scale_value), Color(0.9, 0.92, 0.8, 0.45), false, 1)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index in [MOUSE_BUTTON_MIDDLE, MOUSE_BUTTON_RIGHT]:
			dragging = event.pressed
			accept_event()
		if not event.pressed: return
		if event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
			var point = screen_to_world(event.position)
			zoom = clampf(zoom * (1.15 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1 / 1.15), 0.55, 3.0)
			camera += point - screen_to_world(event.position)
			queue_redraw()
			accept_event()
		elif event.button_index == MOUSE_BUTTON_LEFT:
			var point = screen_to_world(event.position)
			if point.x < 0 or point.y < 0 or point.x >= view.get("world", {}).get("size", 64) or point.y >= view.get("world", {}).get("size", 64): return
			target = point.floor() + Vector2(0.5, 0.5)
			target_changed.emit(target)
			var kind = "cell"
			var entity_id = 0
			var nearest = 10.0
			for p in view.individuals.people:
				if not p.alive: continue
				var distance = world_to_screen(Vector2(p.x, p.y)).distance_to(event.position)
				if distance < nearest:
					nearest = distance
					entity_id = p.id
					kind = "person"
			if kind == "cell":
				for home in view.households.homes:
					if world_to_screen(Vector2(home.x, home.y)).distance_to(event.position) < 10:
						kind = "household"
						entity_id = home.id
			selected_person = entity_id if kind == "person" else 0
			selected.emit(kind, entity_id, point.floor())
			queue_redraw()
			accept_event()
	elif event is InputEventMouseMotion:
		hover_cell = screen_to_world(event.position).floor()
		if dragging:
			camera -= event.relative / (tile_size * zoom)
			queue_redraw()
		queue_redraw()

func _process(delta: float) -> void:
	if not has_focus() and not get_rect().has_point(get_parent().get_local_mouse_position()): return
	var direction = Vector2(float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A)), float(Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_W)))
	if direction != Vector2.ZERO:
		camera += direction * delta * 16 / zoom
		queue_redraw()
