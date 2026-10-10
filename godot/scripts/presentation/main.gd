extends Control

const Session = preload("res://scripts/simulation/session.gd")
const WorldMap = preload("res://scripts/presentation/world_map.gd")
const ObservationClock = preload("res://scripts/presentation/observation_clock.gd")
const PagedText = preload("res://scripts/presentation/paged_text.gd")
const INK = Color("e2e6dc")
const MUTED = Color("9eafa8")
const GOLD = Color("ddc18b")
const TEAL = Color("8acdbc")
const ACTIVITY = {"rest": "休息", "care": "照護", "social": "家庭／交流", "farm": "收穫作物", "build": "建造／維護", "gather_food": "採集食物", "gather_wood": "採集木材", "gather_stone": "採集石材", "gather_fiber": "採集纖維", "dead": "已離世"}
const OCCUPATION = {"dependent": "受照護者", "food_producer": "食物生產者", "builder": "建造者", "gatherer": "資源採集者"}

var sim = Session.new()
var observation_clock = ObservationClock.new()
var night_event: Dictionary = {}
var view: Dictionary = {}
var map: Control
var date_label: Label
var stats_label: Label
var dp_label: Label
var faith_label: Label
var rain_preview: Label
var oracle_summary: Label
var inspector: RichTextLabel
var event_feed: RichTextLabel
var status_label: Label
var pause_button: Button
var rain_button: Button
var oracle_button: Button
var conclude_button: Button
var seed_input: SpinBox
var radius_input: SpinBox
var intensity_input: SpinBox
var duration_input: SpinBox
var oracle_duration: SpinBox
var saint_select: OptionButton
var person_select: OptionButton
var prayer_select: OptionButton
var advanced: VBoxContainer
var selected_kind: String = "overview"
var selected_id: int = 0
var selected_cell = Vector2(24, 26)
var refresh_timer: float = 0.0
var feedback_remaining: float = 0.0
var saints_in_menu: Array = []
var prayers_in_menu: Array = []
var last_feed_id: int = 0
var speed_buttons: Array = []
var last_result: Dictionary = {}
var divine_tabs: TabContainer
var rain_target_toggle: CheckButton
var night_skip_toggle: CheckButton
var clock_status: Label
var inspector_pages
var history_pages
var rain_settings: AcceptDialog
var hint_dialog: AcceptDialog
var hint_pages
var people_page: int = 0
var people_count: int = 0
var people_page_label: Label
var people_previous: Button
var people_next: Button
const PEOPLE_PER_PAGE = 8

func _ready() -> void:
	get_window().min_size = Vector2i(1280, 720)
	var system_font = SystemFont.new()
	system_font.font_names = PackedStringArray(["Microsoft JhengHei", "Noto Sans TC", "Noto Sans", "sans-serif"])
	var ui_theme = Theme.new()
	ui_theme.default_font = system_font
	ui_theme.default_font_size = 14
	ui_theme.set_color("font_color", "Label", INK)
	ui_theme.set_color("default_color", "RichTextLabel", INK)
	for state in ["normal", "hover", "pressed", "disabled", "focus"]:
		var box = StyleBoxFlat.new()
		box.bg_color = Color("1d363b") if state == "normal" else (Color("304c4d") if state == "hover" else Color("416660") if state == "pressed" else Color("172a30"))
		box.border_color = Color("4c6962")
		box.set_border_width_all(1 if state == "focus" else 0)
		box.set_corner_radius_all(4)
		box.content_margin_left = 10
		box.content_margin_right = 10
		box.content_margin_top = 7
		box.content_margin_bottom = 7
		ui_theme.set_stylebox(state, "Button", box)
		ui_theme.set_stylebox(state, "OptionButton", box)
	ui_theme.set_color("font_color", "Button", INK)
	ui_theme.set_color("font_disabled_color", "Button", Color("687c76"))
	ui_theme.set_color("font_color", "OptionButton", INK)
	ui_theme.set_color("font_color", "LineEdit", INK)
	theme = ui_theme
	build_ui()
	sim.start()
	observation_clock.reset(sim)
	sim.history.archive_path = "user://history.jsonl"
	sim.command_archive_path = "user://commands.jsonl"
	fill_people()
	refresh_view()

func text_label(text: String, font_size: int = 14, color: Color = INK) -> Label:
	var label = Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	return label

func wrap_label(text: String, font_size: int = 13, color: Color = MUTED) -> Label:
	var label = text_label(text, font_size, color)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return label

func button(text: String, callable: Callable, parent: Control) -> Button:
	var item = Button.new()
	item.text = text
	item.pressed.connect(callable)
	parent.add_child(item)
	return item

func panel(parent: Control) -> VBoxContainer:
	var shell = PanelContainer.new()
	var style = StyleBoxFlat.new()
	style.bg_color = Color("12272d")
	style.border_color = Color("2b4446")
	style.set_border_width_all(1)
	style.set_corner_radius_all(7)
	style.content_margin_left = 14
	style.content_margin_right = 14
	style.content_margin_top = 12
	style.content_margin_bottom = 12
	shell.add_theme_stylebox_override("panel", style)
	parent.add_child(shell)
	var column = VBoxContainer.new()
	column.add_theme_constant_override("separation", 7)
	shell.add_child(column)
	return column

func spin(parent: Control, caption: String, minimum: float, maximum: float, step_value: float, initial: float) -> SpinBox:
	var row = HBoxContainer.new()
	parent.add_child(row)
	var label = text_label(caption, 13, MUTED)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(label)
	var input = SpinBox.new()
	input.min_value = minimum
	input.max_value = maximum
	input.step = step_value
	input.value = initial
	input.custom_minimum_size.x = 96
	row.add_child(input)
	return input

func rich(parent: Control, height: float = 0.0) -> RichTextLabel:
	var label = RichTextLabel.new()
	label.bbcode_enabled = true
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	label.custom_minimum_size.y = height
	label.add_theme_color_override("default_color", INK)
	parent.add_child(label)
	return label

func hint_button(parent: Control, title: String, explanation: String) -> Button:
	var item = button("?", show_hint.bind(title, explanation), parent)
	item.tooltip_text = explanation
	return item

func show_hint(title: String, explanation: String) -> void:
	hint_dialog.title = title
	hint_pages.set_content(explanation, false, true)
	hint_dialog.popup_centered(Vector2i(460, 300))

func build_ui() -> void:
	var margin = MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]: margin.add_theme_constant_override("margin_" + side, 16)
	add_child(margin)
	var root = VBoxContainer.new()
	root.add_theme_constant_override("separation", 8)
	margin.add_child(root)
	var header = HBoxContainer.new()
	header.add_theme_constant_override("separation", 12)
	root.add_child(header)
	var title = VBoxContainer.new()
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	title.add_child(text_label("WORLD OF GOD", 18, GOLD))
	hint_button(header, "河谷初聲 · 核心機制 PoC", "觀察居民自主形成聚落。\n在居民附近選擇雨心，預覽成本並施放降雨。\n聖者出現後，可傳達糧食神諭。\n點選居民、家庭或世界紀錄，查看真實決策與因果。\n\n地圖：滾輪縮放、右鍵拖曳或 WASD 平移。\n空白鍵：暫停／繼續；1：降雨選點；Esc：取消選點。\n\n範圍：一個河谷、Rain、food.produce。")
	date_label = text_label("", 14, INK)
	header.add_child(date_label)
	pause_button = button("暫停", toggle_pause, header)
	for value in [1, 4, 16]:
		var speed_button = button(str(value) + "×", set_speed.bind(value), header)
		speed_button.toggle_mode = true
		speed_buttons.append(speed_button)
	button("存檔", save_world, header)
	button("讀檔", load_world, header)
	var seed_row = HBoxContainer.new()
	header.add_child(seed_row)
	seed_row.add_child(text_label("Seed", 12, MUTED))
	seed_input = SpinBox.new()
	seed_input.min_value = 0
	seed_input.max_value = 999999
	seed_input.value = 1106
	seed_input.custom_minimum_size.x = 100
	seed_row.add_child(seed_input)
	button("重啟", restart_world, header)
	var stats_row = HBoxContainer.new()
	stats_row.add_theme_constant_override("separation", 16)
	root.add_child(stats_row)
	stats_label = text_label("", 16, INK)
	stats_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stats_row.add_child(stats_label)
	clock_status = text_label("", 12, TEAL)
	stats_row.add_child(clock_status)
	night_skip_toggle = CheckButton.new()
	night_skip_toggle.text = "夜間快進"
	night_skip_toggle.button_pressed = true
	night_skip_toggle.tooltip_text = "20:00–08:00 加快 8 倍；重大事件會暫停，繼續後 10 秒內不自動暫停。"
	night_skip_toggle.toggled.connect(func(enabled): observation_clock.night_skip_enabled = enabled; refresh_view())
	stats_row.add_child(night_skip_toggle)
	var body = HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 12)
	root.add_child(body)
	var left = panel(body)
	left.get_parent().custom_minimum_size.x = 260
	left.add_child(text_label("神意", 16, GOLD))
	dp_label = wrap_label("", 16, TEAL)
	left.add_child(dp_label)
	faith_label = wrap_label("")
	left.add_child(faith_label)
	left.add_child(HSeparator.new())
	left.add_child(text_label("降雨 · 改善土地水分", 14, GOLD))
	hint_button(left, "降雨 Rain", "雨增加土壤水分；食物仍需作物生長與居民實際收穫。\n神力成本與冷卻由模擬評估，取決於半徑、強度、持續時間與熟練度。\n中心必須有當地信仰臨在。暫停時冷卻倒數也停止。")
	rain_target_toggle = CheckButton.new()
	rain_target_toggle.text = "在地圖選擇降雨中心"
	rain_target_toggle.toggled.connect(set_rain_targeting)
	left.add_child(rain_target_toggle)
	var quick_row = HBoxContainer.new()
	left.add_child(quick_row)
	button("快速設定", quick_rain, quick_row)
	button("進階設定", func(): advanced.visible = true; rain_settings.popup_centered(Vector2i(410, 240)), quick_row)
	rain_settings = AcceptDialog.new()
	rain_settings.title = "降雨參數"
	add_child(rain_settings)
	advanced = VBoxContainer.new()
	rain_settings.add_child(advanced)
	radius_input = spin(advanced, "半徑（格）", 2, 14, 1, 9)
	intensity_input = spin(advanced, "強度", 0.25, 2, 0.25, 1)
	duration_input = spin(advanced, "持續（天）", 1, 30, 1, 12)
	for input in [radius_input, intensity_input, duration_input]: input.value_changed.connect(func(_value): update_rain_preview())
	rain_preview = wrap_label("", 13, INK)
	left.add_child(rain_preview)
	rain_button = button("施放降雨", cast_rain, left)
	left.add_child(HSeparator.new())
	left.add_child(text_label("神諭 · food.produce", 14, GOLD))
	hint_button(left, "糧食神諭", "聖者接收、地方傳播，居民自行比較可行工作。\n神諭使用聖者配額，不消耗 DP；同一聖者不能同時接收相同意圖。\n初始配額 4，每三個模擬月補充 1。\n普通成功不會自動結束；宣告結束消耗 1 配額。")
	saint_select = OptionButton.new()
	left.add_child(saint_select)
	saint_select.item_selected.connect(func(_index): refresh_view())
	oracle_duration = spin(left, "神諭期限（月）", 1, 24, 1, 6)
	oracle_button = button("向聖者傳達神諭", issue_oracle, left)
	conclude_button = button("宣告此神諭結束（1 配額）", conclude_oracle, left)
	oracle_summary = wrap_label("", 12, MUTED)
	left.add_child(oracle_summary)
	left.add_child(HSeparator.new())
	left.add_child(text_label("居民的祈求", 15, GOLD))
	prayer_select = OptionButton.new()
	left.add_child(prayer_select)
	button("查看家庭與位置", focus_prayer, left)
	# Keep both core interventions reachable without scrolling past the other.
	var left_children = left.get_children()
	divine_tabs = TabContainer.new()
	divine_tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left.add_child(divine_tabs)
	for section in [{"name": "降雨", "from": 4, "to": 10}, {"name": "神諭", "from": 11, "to": 18}, {"name": "祈求", "from": 19, "to": 22}]:
		var tab_column = VBoxContainer.new()
		tab_column.name = section.name
		tab_column.add_theme_constant_override("separation", 8)
		divine_tabs.add_child(tab_column)
		var heading = HBoxContainer.new()
		if section.name != "祈求": tab_column.add_child(heading)
		for index in range(section.from, section.to):
			var child = left_children[index]
			left.remove_child(child)
			if section.name != "祈求" and index < section.from + 2:
				heading.add_child(child)
				if index == section.from: child.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			else: tab_column.add_child(child)
		if section.name == "祈求": heading.free()
	for index in [10, 18]:
		left.remove_child(left_children[index])
		left_children[index].queue_free()
	var middle = panel(body)
	middle.get_parent().size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var map_header = HBoxContainer.new()
	middle.add_child(map_header)
	var map_title = text_label("河谷  /  觀察世界", 16, GOLD)
	map_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	map_header.add_child(map_title)
	var layers = OptionButton.new()
	for text in ["地貌", "土壤濕度", "未收穫作物"]: layers.add_item(text)
	layers.item_selected.connect(func(index): map.layer = index; map.rebuild_texture(); map.queue_redraw())
	map_header.add_child(layers)
	button("聚落", focus_settlement, map_header)
	button("置中", func(): map.camera = Vector2(29, 29); map.zoom = 1.15; map.queue_redraw(), map_header)
	map = WorldMap.new()
	map.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	map.size_flags_vertical = Control.SIZE_EXPAND_FILL
	map.custom_minimum_size = Vector2(260, 210)
	map.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	map.selected.connect(select_entity)
	map.target_changed.connect(func(_point): update_rain_preview())
	middle.add_child(map)
	map.tooltip_text = "點選居民／土地；滾輪縮放；右鍵拖曳或 WASD 平移。金環是聖者，虛線圓是家庭。休息居民可由右側選單查看。"
	var right = panel(body)
	right.get_parent().custom_minimum_size.x = 304
	var inspect_header = HBoxContainer.new()
	right.add_child(inspect_header)
	var inspect_title = text_label("觀察與原因", 18, GOLD)
	inspect_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inspect_header.add_child(inspect_title)
	button("總覽", func(): select_entity("overview", 0, Vector2.ZERO), inspect_header)
	person_select = OptionButton.new()
	person_select.item_selected.connect(func(index):
		var person_id = person_select.get_item_id(index)
		if person_id > 0: select_entity("person", person_id, Vector2.ZERO))
	right.add_child(person_select)
	var people_navigation = HBoxContainer.new()
	right.add_child(people_navigation)
	people_previous = button("上一組", change_people_page.bind(-1), people_navigation)
	people_page_label = text_label("", 12, MUTED)
	people_page_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	people_page_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	people_navigation.add_child(people_page_label)
	people_next = button("下一組", change_people_page.bind(1), people_navigation)
	var inspect_actions = HBoxContainer.new()
	right.add_child(inspect_actions)
	button("家庭", focus_household, inspect_actions)
	button("聚落", focus_settlement, inspect_actions)
	inspector_pages = PagedText.new()
	inspector_pages.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(inspector_pages)
	inspector = inspector_pages.body
	inspector.meta_clicked.connect(func(meta): show_event(int(str(meta).trim_prefix("event:"))))
	var bottom = panel(root)
	bottom.get_parent().custom_minimum_size.y = 140
	bottom.add_child(text_label("世界紀錄  /  點選事件查看實際因果與決策輸入", 14, GOLD))
	history_pages = PagedText.new()
	history_pages.size_flags_vertical = Control.SIZE_EXPAND_FILL
	bottom.add_child(history_pages)
	event_feed = history_pages.body
	event_feed.meta_clicked.connect(func(meta): show_event(int(str(meta).trim_prefix("event:"))))
	status_label = wrap_label("觀察世界 · 空白鍵暫停／繼續", 12, TEAL)
	root.add_child(status_label)
	hint_dialog = AcceptDialog.new()
	add_child(hint_dialog)
	hint_pages = PagedText.new()
	hint_dialog.add_child(hint_pages)

func _process(delta: float) -> void:
	advance_observation(delta)
	if feedback_remaining > 0.0:
		feedback_remaining = maxf(0.0, feedback_remaining - delta)
		if feedback_remaining == 0.0 and night_event.is_empty(): status_label.text = ""
	refresh_timer += delta
	if refresh_timer >= 0.35:
		refresh_timer = 0.0
		refresh_view()

func advance_observation(delta: float) -> void:
	if sim.paused: return
	var event = observation_clock.advance_wall(sim, delta)
	if event.is_empty(): return
	night_event = event
	feedback_remaining = 0.0
	sim.paused = true
	map.event_people = night_event_people(night_event)
	status_label.text = "夜間事件：%s　按「繼續」恢復觀察。" % night_event.message
	status_label.add_theme_color_override("font_color", GOLD)
	fill_people()
	show_event(night_event.id)
	refresh_view()

func night_event_people(event: Dictionary) -> Array:
	var subjects: Array = event.subjects
	match event.kind:
		"birth", "pregnancy": return subjects.slice(0, 2)
		"shortage", "migration", "prayer_fulfilled":
			return sim.households.get_home(subjects[0]).get("members", []).duplicate() if not subjects.is_empty() else []
		"settlement":
			var people: Array = []
			for home_id in subjects: people.append_array(sim.households.get_home(home_id).get("members", []))
			return people
		"rain", "rain_ended": return []
		_: return subjects.slice(0, 1)

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_SPACE: toggle_pause()
			KEY_1: set_rain_targeting(not map.rain_mode)
			KEY_ESCAPE: set_rain_targeting(false)
			_: return
		get_viewport().set_input_as_handled()

func format_date(seconds: int) -> String:
	var days = seconds / sim.day_seconds()
	return "第 %d 年 · %d 月 %d 日" % [days / int(sim.rules.year_days) + 1, days / int(sim.rules.month_days) % 12 + 1, days % int(sim.rules.month_days) + 1]

func format_time(seconds: int) -> String:
	var minutes = int(float(seconds % sim.day_seconds()) * 1440.0 / sim.day_seconds())
	return "%02d:%02d" % [minutes / 60, minutes % 60]

func refresh_view() -> void:
	view = sim.snapshot()
	map.daytime = observation_clock.is_daytime(sim)
	map.set_snapshot(view)
	if people_count != view.individuals.people.size(): fill_people()
	var stats = view.stats
	date_label.text = format_date(sim.time) + "\n" + format_time(sim.time) + (" · 白天" if map.daytime else " · 夜間")
	clock_status.text = "夜間事件 · 暫停" if sim.paused and not night_event.is_empty() else ("已暫停" if sim.paused else ("夜間快進 %d×" % (sim.speed * observation_clock.multiplier(sim)) if observation_clock.multiplier(sim) > 1 else "觀察 %d×" % sim.speed))
	if not sim.paused and observation_clock.grace_remaining > 0.0:
		clock_status.text += " · 緩衝 %d 秒" % ceili(observation_clock.grace_remaining)
	pause_button.text = "繼續" if sim.paused else "暫停"
	for i in speed_buttons.size(): speed_buttons[i].button_pressed = sim.speed == [1, 4, 16][i]
	stats_label.text = "居民 %d   ·   家庭 %d   ·   聚落 %d   ·   食物 %.1f（%.1f 天）   ·   信徒 %d   ·   %s" % [stats.population, view.households.homes.size(), stats.settlements, stats.food, stats.food_days, stats.followers, view.world.weather]
	dp_label.text = "%.1f / %.0f DP · +%.2f/天" % [view.divine.dp, view.divine.cap, view.divine.rate]
	faith_label.tooltip_text = "信徒需虔誠 40+。神力恢復按在世信仰居民的虔誠級距計算。"
	var saints = sim.religion.living_saints(sim)
	if saints != saints_in_menu:
		saints_in_menu = saints.duplicate()
		saint_select.clear()
		for id_value in saints: saint_select.add_item(sim.individuals.get_person(id_value).name, id_value)
		if saints.is_empty(): saint_select.add_item("聖者尚未出現", -1)
	if not saints.is_empty():
		for index in saints.size():
			var person_id = saint_select.get_item_id(index)
			saint_select.set_item_text(index, "%s · 配額 %d/4" % [sim.individuals.get_person(person_id).name, sim.religion.saints[person_id].quota])
	var oracle_evaluation = sim.religion.evaluate_oracle(sim, oracle_parameters())
	oracle_button.disabled = not oracle_evaluation.ok
	oracle_button.tooltip_text = oracle_evaluation.reason
	conclude_button.disabled = active_oracle().is_empty()
	var current = active_oracle()
	if current.is_empty(): oracle_summary.text = oracle_evaluation.reason
	else:
		var stages = current.stages
		oracle_summary.text = "有效神諭 #%d · 尚餘 %.1f 天\n聽見 %d · 接受 %d · 嘗試 %d\n取得食物 %d 人 · 實際 %.1f\n同類型已鎖定；成功後仍有效。" % [current.id, float(current.expires_at - sim.time) / sim.day_seconds(), stages.heard, stages.accepted, stages.attempted, stages.outcome, current.food_output]
	var pending: Array = []
	for home_id in view.religion.prayers:
		if view.religion.prayers[home_id].status == "pending": pending.append(home_id)
	var shortages = 0
	for home in view.households.homes:
		if home.shortage_days >= 3 and home.satisfaction < 0.85: shortages += 1
	faith_label.text = "祈求待回 %d · 已改善 %d\n缺糧 %d 戶 · 雨熟練 Lv%d" % [pending.size(), view.religion.fulfilled_count, shortages, view.divine.skills.rain.mastery]
	if pending != prayers_in_menu:
		prayers_in_menu = pending.duplicate()
		prayer_select.clear()
		for home_id in pending: prayer_select.add_item("第 %d 戶：食物保障" % home_id, home_id)
		if pending.is_empty(): prayer_select.add_item("目前沒有待回應祈求", -1)
	update_rain_preview()
	update_inspector()
	if view.history.next_id != last_feed_id:
		last_feed_id = view.history.next_id
		var lines: Array = []
		var events = view.history.events
		for event in events:
			# Retain causal intermediate records for inspection, while the feed
			# shows major events instead of every resident's response stage.
			if event.kind not in ObservationClock.NIGHT_EVENTS and event.kind not in ["genesis", "prayer", "oracle_received"]: continue
			var color = "ddc18b" if event.kind in ["rain", "oracle_issued", "prayer_fulfilled", "settlement", "saint"] else "a6bab2"
			lines.append("[color=#%s][url=event:%d]#%d  %s %s[/url][/color]  %s" % [color, event.id, event.id, format_date(event.time), format_time(event.time), event.message])
			if lines.size() > 48: lines.pop_front()
		history_pages.set_content("\n".join(lines), true)

func fill_people() -> void:
	people_count = sim.individuals.people.size()
	var page_count = maxi(1, ceili(float(people_count) / PEOPLE_PER_PAGE))
	people_page = clampi(people_page, 0, page_count - 1)
	person_select.clear()
	person_select.add_item("選擇居民…", 0)
	for index in range(people_page * PEOPLE_PER_PAGE, mini(people_count, (people_page + 1) * PEOPLE_PER_PAGE)):
		var p = sim.individuals.people[index]
		person_select.add_item("#%d %s" % [p.id, p.name], p.id)
		if selected_kind == "person" and p.id == selected_id: person_select.select(person_select.item_count - 1)
	people_page_label.text = "%d / %d 組" % [people_page + 1, page_count]
	people_previous.disabled = people_page == 0
	people_next.disabled = people_page == page_count - 1

func change_people_page(change: int) -> void:
	people_page += change
	fill_people()

func rain_parameters() -> Dictionary:
	return {"type": "rain", "x": map.target.x, "y": map.target.y, "radius": radius_input.value, "intensity": intensity_input.value, "days": duration_input.value}

func update_rain_preview() -> void:
	if not is_instance_valid(map) or sim.rules.is_empty(): return
	map.rain_radius = radius_input.value
	var preview = sim.divine.evaluate(sim, rain_parameters())
	rain_preview.text = "中心 (%.0f, %.0f) · 半徑 %.0f\n強度 %.2f · 持續 %.0f 天\n成本 %.1f DP · 臨在 %.2f\n%s" % [map.target.x, map.target.y, radius_input.value, intensity_input.value, duration_input.value, preview.cost, preview.presence.weighted, preview.reason]
	rain_preview.add_theme_color_override("font_color", INK if preview.ok else Color("d6a584"))
	rain_button.disabled = not preview.ok
	rain_target_toggle.disabled = not preview.ok
	var cooldown = maxf(0.0, float(sim.divine.skills.rain.cooldown_until - sim.time) / sim.day_seconds())
	rain_button.text = "冷卻中 · %.1f 天" % cooldown if cooldown > 0.0 else ("施放降雨" if preview.ok else "降雨不可用")
	if not preview.ok:
		rain_target_toggle.set_pressed_no_signal(false)
		map.rain_mode = false
	map.queue_redraw()

func set_rain_targeting(enabled: bool) -> void:
	if not is_instance_valid(map) or sim.rules.is_empty(): return
	var evaluation = sim.divine.evaluate(sim, rain_parameters())
	map.rain_mode = enabled and evaluation.ok
	rain_target_toggle.set_pressed_no_signal(map.rain_mode)
	map.queue_redraw()
	if enabled and not evaluation.ok: show_result(evaluation)

func quick_rain() -> void:
	radius_input.value = sim.rules.rain_standard_radius
	intensity_input.value = 1
	duration_input.value = sim.rules.rain_standard_days
	rain_settings.hide()
	set_rain_targeting(true)
	update_rain_preview()

func show_result(result: Dictionary) -> void:
	last_result = result
	feedback_remaining = 5.0
	status_label.text = result.reason
	status_label.add_theme_color_override("font_color", TEAL if result.ok else Color("e0ac86"))
	refresh_view()

func cast_rain() -> void:
	var result = sim.submit_command(rain_parameters())
	if result.ok: set_rain_targeting(false)
	show_result(result)

func active_oracle() -> Dictionary:
	if saint_select.item_count == 0: return {}
	var person_id = saint_select.get_selected_id()
	for oracle in sim.religion.oracles:
		if oracle.status == "active" and oracle.saint_id == person_id: return oracle
	return {}

func oracle_parameters() -> Dictionary:
	return {"type": "oracle", "saint_id": saint_select.get_selected_id(), "intent": "food.produce", "months": oracle_duration.value}

func issue_oracle() -> void:
	show_result(sim.submit_command(oracle_parameters()))

func conclude_oracle() -> void:
	var oracle = active_oracle()
	show_result(sim.submit_command({"type": "conclude", "oracle_id": oracle.get("id", -1)}))

func toggle_pause() -> void:
	sim.paused = not sim.paused
	if not sim.paused:
		observation_clock.resumed()
		night_event.clear()
		map.event_people.clear()
		status_label.text = ""
		feedback_remaining = 0.0
	refresh_view()

func set_speed(value: int) -> void:
	sim.speed = value
	refresh_view()

func restart_world() -> void:
	sim.start({}, int(seed_input.value))
	observation_clock.reset(sim)
	night_event.clear()
	map.event_people.clear()
	sim.history.archive_path = "user://history.jsonl"
	sim.command_archive_path = "user://commands.jsonl"
	selected_kind = "overview"
	saints_in_menu = [-999]
	prayers_in_menu = [-999]
	last_feed_id = 0
	fill_people()
	show_result({"ok": true, "reason": "以 Seed %d 重新開始同一河谷預設。" % sim.scenario.seed})

func save_world() -> void:
	show_result(sim.save_file("user://river_valley.wog"))

func load_world() -> void:
	var result = sim.load_file("user://river_valley.wog")
	if result.ok:
		observation_clock.reset(sim)
		night_event.clear()
		map.event_people.clear()
		saints_in_menu = [-999]
		prayers_in_menu = [-999]
		last_feed_id = 0
		seed_input.value = sim.scenario.seed
		fill_people()
	show_result(result)

func select_entity(kind: String, id_value: int, cell: Vector2) -> void:
	selected_kind = kind
	selected_id = id_value
	selected_cell = cell
	map.selected_person = id_value if kind == "person" else 0
	inspector_pages.page = 0
	inspector_pages.queue_reflow()
	if kind == "person":
		people_page = (id_value - 1) / PEOPLE_PER_PAGE
		fill_people()
	update_inspector()
	map.queue_redraw()

func focus_household() -> void:
	var home_id = selected_id if selected_kind == "household" else (sim.individuals.get_person(selected_id).get("household_id", 1) if selected_kind == "person" else 1)
	var home = sim.households.get_home(home_id)
	map.camera = Vector2(home.x, home.y)
	select_entity("household", home.id, Vector2.ZERO)

func focus_settlement() -> void:
	if sim.settlements.towns.is_empty():
		show_result({"ok": false, "reason": "目前尚未形成聚落；居民正在自主生活。"})
		return
	var town = sim.settlements.towns[0]
	map.camera = Vector2(town.x + 4, town.y)
	select_entity("settlement", town.id, Vector2.ZERO)

func focus_prayer() -> void:
	var home = sim.households.get_home(prayer_select.get_selected_id())
	if home.is_empty(): return
	map.target = Vector2(home.x, home.y)
	map.camera = Vector2(home.x + 4, home.y)
	rain_target_toggle.button_pressed = true
	select_entity("household", home.id, Vector2.ZERO)
	update_rain_preview()

func inventory_text(items: Dictionary) -> String:
	return "食物 %.1f  木材 %.1f\n石材 %.1f  纖維 %.1f" % [items.food, items.wood, items.stone, items.fiber]

func food_access_text(home: Dictionary) -> String:
	var access = sim.households.food_access_view(sim)[home.id]
	return "家庭 %.1f ＋ 可達共用預估份額 %.1f\n可用 %.1f（%.1f 天）；每日需求 %.2f\n%s" % [access.own, access.shared, access.available, access.available / maxf(0.1, access.need), access.need, "具備共用儲備存取資格。" if access.town_id > 0 else "目前無可達且有資格使用的共用儲備。"]

func update_inspector() -> void:
	if selected_kind == "event": return
	var content = ""
	match selected_kind:
		"person":
			var p = sim.individuals.get_person(selected_id)
			if p.is_empty(): return
			var home = sim.households.get_home(p.household_id)
			var calling = sim.religion.calling_pressure(sim, p)
			content = "[b]%s  #%d[/b]\n%.1f 歲 · %s\n\n生命 %.1f  飢餓 %.1f\n位置 (%.1f, %.1f)\n家庭 #%d · 聚落 #%d\n\n[b]生計[/b] %s\n[b]此刻[/b] %s\n農耕 %.2f · 採集 %.2f\n建造 %.2f · 傳教 %.2f\n\n[b]決策原因[/b]\n%s\n\n[b]信仰[/b]\n%s · 虔誠 %.1f\n聖者 %s · 祭司 %s\n神諭壓力 %.2f\n\n[b]家庭庫存[/b]\n%s" % [p.name, p.id, p.age, "在世" if p.alive else "已離世", p.health, p.hunger, p.x, p.y, p.household_id, p.settlement_id, OCCUPATION.get(p.occupation, p.occupation), ACTIVITY.get(p.activity, p.activity), p.skills.agriculture, p.skills.gathering, p.skills.construction, p.skills.preaching, p.reason, "河谷之神" if p.religion_id == sim.religion.id else "尚無歸屬", p.devotion, "是" if sim.religion.eligible(sim, p.id) else "否", "是" if p.id in sim.religion.priests else "否", calling.strength, inventory_text(home.inventory)]
			content += "\n\n[b]食物保障[/b]\n" + food_access_text(home)
			if not p.decision.is_empty():
				content += "\n\n[b]上次工作比較[/b]\n" + format_date(p.decision.get("evaluated_at", sim.time)) + " " + format_time(p.decision.get("evaluated_at", sim.time))
				for activity in p.decision.get("scores", {}): content += "\n%s：%.2f" % [ACTIVITY.get(activity, activity), p.decision.scores[activity]]
		"household":
			var home = sim.households.get_home(selected_id)
			if home.is_empty(): return
			content = "[b]第 %d 戶[/b]\n" % home.id
			for person_id in home.members:
				var p = sim.individuals.get_person(person_id)
				content += "%s · %.1f 歲 · %s\n" % [p.name, p.age, "在世" if p.alive else "已離世"]
			content += "\n[b]家庭庫存[/b]\n%s\n\n每日食物需求 %.2f\n可用食物 %.1f 天\n昨日食物滿足 %.0f%%\n持續不足 %d 天\n受照護者 %d\n住宅 %s\n\n家庭優先使用自有食物，缺口才向共用儲備求助。" % [inventory_text(home.inventory), sim.households.food_need(sim, home), sim.households.accessible_food(sim, home) / maxf(0.1, sim.households.food_need(sim, home)), home.satisfaction * 100, home.shortage_days, home.care_load, "尚在營地" if home.dwelling_id == 0 else "#%d" % home.dwelling_id]
			content += "\n\n[b]存取與保障[/b]\n" + food_access_text(home)
		"settlement":
			var town = sim.settlements.get_town(selected_id)
			if town.is_empty(): return
			var demand = sim.settlements.demand(sim, town.id)
			content = "[b]%s  #%d[/b]\n%s 自主形成\n家庭 %d · 建築 %d\n\n[b]共用儲備[/b]\n%s\n\n新產出：%.0f%% 家庭／%.0f%% 共用\n\n[b]基礎工作需求[/b]\n食物 %.2f · 住房 %.2f\n木材 %.0f · 石材 %.0f · 纖維 %.0f\n維護 %.2f · 貿易 %.0f\n\n" % [town.name, town.id, format_date(town.formed_at), town.households.size(), town.structures.size(), inventory_text(town.storage), sim.rules.household_output_share * 100, (1 - sim.rules.household_output_share) * 100, demand.food, demand.housing, demand.wood, demand.stone, demand.fiber, demand.maintenance, demand.trade]
			if not town.project.is_empty(): content += "施工：%s\n已投入勞動 %.1f / %.1f\n" % [town.project.kind, town.project.work, town.project.required_work]
			content += "\n工作需求描述缺口；每位居民自行比較與選擇。"
		"cell":
			var cell = sim.world.cell_at(int(selected_cell.x), int(selected_cell.y))
			if cell.is_empty(): return
			content = "[b]土地 (%d, %d)[/b]\n地貌 %s\n\n土壤適性 %.2f\n離河道 %.1f 格\n濕度 %.2f\n作物 %.2f（未收穫）\n其中降雨改善的生長 %.2f\n野生食物 %.2f\n木材 %.2f · 石材 %.2f\n纖維 %.2f\n\n作物與自然資源都要經過居民的真實勞動，才會進入庫存。" % [cell.x, cell.y, cell.terrain, cell.soil, cell.water_distance, cell.moisture, cell.crops, cell.rain_bonus, cell.wild_food, cell.wood, cell.stone, cell.fiber]
		_:
			content = "[b]河谷 · 世界總覽[/b]\n\n居民 %d · 家庭 %d · 聚落 %d\n食物 %.1f（%.1f 天）\n待回應祈求 %d\n\n[b]世界自行演化[/b]\n出生 %d · 離世 %d\n家庭搬遷 %d\n實際收穫 %.1f\n降雨改善的收穫 %.1f\n\n點選居民、家庭或紀錄查看原因。\n操作與規則說明可由「?」開啟。" % [sim.stats().population, sim.households.homes.size(), sim.settlements.towns.size(), sim.stats().food, sim.stats().food_days, prayers_in_menu.size(), sim.individuals.births, sim.individuals.deaths, sim.households.migrations, sim.world.harvest_total, sim.world.rain_bonus_harvest]
	inspector_pages.set_content(content)

func show_event(event_id: int) -> void:
	selected_kind = "event"
	selected_id = event_id
	for event in sim.history.events:
		if event.id != event_id: continue
		var content = "[b]事件 #%d · %s[/b]\n%s %s\n\n%s\n\n[b]實際父事件[/b]\n" % [event.id, event.kind, format_date(event.time), format_time(event.time), event.message]
		if event.parents.is_empty(): content += "未記錄直接父事件。\n"
		for parent in event.parents: content += "[url=event:%d]查看 #%d[/url]\n" % [parent, parent]
		if not event.reasons.is_empty(): content += "\n[b]實際使用的理由／上下文[/b]\n" + JSON.stringify(event.reasons, "  ")
		content += "\n\n對象 IDs：" + str(event.subjects)
		inspector_pages.set_content(content, false, true)
		return
	inspector_pages.set_content("事件 #%d 已離開最近 %d 筆的記憶體視窗。舊紀錄保存在 history.jsonl。" % [event_id, sim.rules.history_limit], false, true)
