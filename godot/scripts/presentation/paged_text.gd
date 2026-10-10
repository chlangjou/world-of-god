extends VBoxContainer

# Pagination belongs to presentation. Text, including causal links, stays intact.
var body: RichTextLabel
var previous: Button
var next: Button
var counter: Label
var content: String = ""
var pages: Array[String] = []
var page: int = 0
var queued: bool = false
var follow_latest: bool = false

func _ready() -> void:
	add_theme_constant_override("separation", 4)
	body = RichTextLabel.new()
	body.bbcode_enabled = true
	body.scroll_active = false
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_child(body)
	var navigation = HBoxContainer.new()
	add_child(navigation)
	previous = Button.new()
	previous.text = "上一頁"
	previous.pressed.connect(func(): follow_latest = false; page = maxi(0, page - 1); display_page())
	navigation.add_child(previous)
	counter = Label.new()
	counter.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	counter.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	navigation.add_child(counter)
	next = Button.new()
	next.text = "下一頁"
	next.pressed.connect(func(): follow_latest = false; page = mini(pages.size() - 1, page + 1); display_page())
	navigation.add_child(next)
	body.resized.connect(queue_reflow)
	queue_reflow()

func set_content(value: String, latest: bool = false, reset: bool = false) -> void:
	if value == content and not reset: return
	follow_latest = latest and (pages.is_empty() or page == pages.size() - 1)
	content = value
	if reset: page = 0
	queue_reflow()

func queue_reflow() -> void:
	if queued: return
	queued = true
	call_deferred("reflow")

func reflow() -> void:
	queued = false
	if not is_instance_valid(body) or body.size.x < 40 or body.size.y < 20: return
	var limit = body.size.y - 4.0
	pages.clear()
	var current = ""
	for line in content.split("\n"):
		body.text = line
		var pieces: Array[String] = [line]
		if body.get_content_height() > limit:
			var tags = RegEx.new()
			tags.compile("\\[/?(?:b|i|u|color(?:=[^\\]]*)?|url(?:=[^\\]]*)?)\\]")
			var plain = tags.sub(line, "", true)
			pieces.clear()
			var part = ""
			var font = body.get_theme_font("normal_font")
			var font_size = body.get_theme_font_size("normal_font_size")
			for character in plain:
				if not part.is_empty() and font.get_string_size(part + character, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x > body.size.x - 8:
					pieces.append(part)
					part = ""
				part += character
			pieces.append(part)
		for piece in pieces:
			var candidate = current + ("\n" if not current.is_empty() else "") + piece
			body.text = candidate
			if not current.is_empty() and body.get_content_height() > limit:
				pages.append(current)
				current = piece
			else: current = candidate
	if not current.is_empty() or pages.is_empty(): pages.append(current)
	page = pages.size() - 1 if follow_latest else clampi(page, 0, pages.size() - 1)
	display_page()

func display_page() -> void:
	if pages.is_empty(): return
	body.text = pages[page]
	counter.text = "%d / %d" % [page + 1, pages.size()]
	previous.disabled = page == 0
	next.disabled = page == pages.size() - 1
