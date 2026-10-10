extends RefCounted

const History = preload("res://scripts/simulation/history.gd")
const World = preload("res://scripts/simulation/world.gd")
const Individuals = preload("res://scripts/simulation/individuals.gd")
const Households = preload("res://scripts/simulation/households.gd")
const Settlements = preload("res://scripts/simulation/settlements.gd")
const Religion = preload("res://scripts/simulation/religion.gd")
const Divine = preload("res://scripts/simulation/divine.gd")

var rules: Dictionary
var scenario: Dictionary
var time: int = 0
var rng = RandomNumberGenerator.new()
var history = History.new()
var world = World.new()
var individuals = Individuals.new()
var households = Households.new()
var settlements = Settlements.new()
var religion = Religion.new()
var divine = Divine.new()
var scheduled: Dictionary = {}
var command_log: Array = []
var profile_us: Dictionary = {"world": 0, "individuals": 0, "economy": 0, "religion": 0, "demography": 0, "divine": 0}
var paused: bool = false
var speed: int = 1
var wall_remainder: float = 0.0
var command_archive_path: String = ""

func start(preset: Dictionary = {}, seed_value: int = -1, overrides: Dictionary = {}) -> void:
	rules = JSON.parse_string(FileAccess.get_file_as_string("res://data/rules.json"))
	rules.merge(overrides, true)
	scenario = JSON.parse_string(FileAccess.get_file_as_string("res://data/river_valley.json"))
	scenario.merge(preset, true)
	if seed_value >= 0:
		scenario.seed = seed_value
	rng.seed = int(scenario.seed)
	time = 0
	history = History.new()
	history.limit = int(rules.history_limit)
	world.start(self)
	households.start(self)
	individuals.start(self)
	settlements.start(self)
	religion.start(self)
	divine.start(self)
	scheduled = {"world": int(rules.world_interval), "individuals": int(rules.individual_interval), "economy": int(rules.economy_interval), "religion": int(rules.religion_interval), "demography": month_seconds()}
	command_log.clear()
	wall_remainder = 0.0
	profile_us = {"world": 0, "individuals": 0, "economy": 0, "religion": 0, "demography": 0, "divine": 0}
	record("genesis", "河谷裡，%d 位居民開始自己的生活。" % individuals.people.size())

func day_seconds() -> int:
	return int(rules.day_seconds)

func month_seconds() -> int:
	return day_seconds() * int(rules.month_days)

func record(kind: String, message: String, subjects: Array = [], parents: Array = [], reasons: Dictionary = {}) -> int:
	return history.record(time, kind, message, subjects, parents, reasons)

func advance_wall(delta: float) -> void:
	if paused:
		return
	wall_remainder += delta * float(day_seconds()) / float(rules.wall_seconds_per_day) * speed
	var amount = int(wall_remainder)
	wall_remainder -= amount
	advance_by(amount)

func advance_by(seconds: int) -> void:
	advance_to(time + maxi(0, seconds))

func advance_to(target: int) -> void:
	if target < time:
		return
	while true:
		var due = target + 1
		for value in scheduled.values():
			due = mini(due, int(value))
		due = mini(due, world.next_deadline())
		due = mini(due, religion.next_deadline(self))
		due = mini(due, individuals.next_deadline())
		if due > target:
			break
		time = due
		var before = Time.get_ticks_usec()
		divine.accrue(self)
		profile_us.divine += Time.get_ticks_usec() - before
		world.expire_effects(self)
		individuals.process_births(self)
		religion.process_deadlines(self)
		# Stable ties: environment -> communication -> personal choice -> economy -> demography.
		for system in ["world", "religion", "individuals", "economy", "demography"]:
			if int(scheduled[system]) != time:
				continue
			before = Time.get_ticks_usec()
			match system:
				"world": world.update(self)
				"religion": religion.update(self)
				"individuals": individuals.update(self)
				"economy":
					settlements.update(self)
					households.consume(self)
					individuals.update_health(self)
					religion.evaluate_needs(self)
				"demography":
					individuals.demography(self)
					households.demography(self)
			profile_us[system] += Time.get_ticks_usec() - before
			var interval = month_seconds() if system == "demography" else int(rules.get(system.trim_suffix("s") + "_interval", rules.get(system + "_interval", rules.day_seconds)))
			if system == "individuals": interval = int(rules.individual_interval)
			scheduled[system] = time + interval
	time = target

func submit_command(command: Dictionary, at_time: int = -1) -> Dictionary:
	if at_time >= 0:
		if at_time < time:
			return {"ok": false, "reason": "命令不能送往過去。"}
		advance_to(at_time)
	divine.accrue(self)
	var result: Dictionary
	match command.get("type", ""):
		"rain": result = divine.cast(self, command)
		"oracle": result = religion.issue_oracle(self, command)
		"conclude": result = religion.conclude(self, int(command.get("oracle_id", -1)))
		_: result = {"ok": false, "reason": "尚未實作的神意。"}
	command_log.append({"time": time, "command": command.duplicate(true), "ok": result.ok, "reason": result.reason})
	if command_log.size() > int(rules.history_limit):
		var old_command = command_log.pop_front()
		if not command_archive_path.is_empty():
			var archive = FileAccess.open(command_archive_path, FileAccess.READ_WRITE) if FileAccess.file_exists(command_archive_path) else FileAccess.open(command_archive_path, FileAccess.WRITE)
			if archive:
				archive.seek_end()
				archive.store_line(JSON.stringify(old_command))
	return result

func snapshot() -> Dictionary:
	# Callers receive copies. Presentation proxies never own authoritative state.
	return {"time": time, "scenario": scenario.duplicate(true), "world": world.state(), "individuals": individuals.state(), "households": households.state(), "settlements": settlements.state(), "religion": religion.state(), "divine": divine.view(self), "history": history.state(), "stats": stats()}

func stats() -> Dictionary:
	var followers = 0
	var alive = 0
	var hungry = 0
	var devotion = 0.0
	for p in individuals.people:
		if not p.alive: continue
		alive += 1
		hungry += int(p.hunger > 30.0)
		followers += int(p.religion_id == religion.id and p.devotion >= 40.0)
		devotion += p.devotion
	var food = households.total_item("food") + settlements.total_item("food")
	return {"population": alive, "followers": followers, "hungry": hungry, "devotion": devotion / maxf(1.0, alive), "food": food, "food_days": food / maxf(1.0, households.daily_food_need(self)), "settlements": settlements.towns.size(), "births": individuals.births, "deaths": individuals.deaths, "dp_rate": divine.rate(self)}

func export_state() -> Dictionary:
	return {"format": 1, "rules": rules.duplicate(true), "scenario": scenario.duplicate(true), "time": time, "rng_state": rng.state, "scheduled": scheduled.duplicate(), "command_log": command_log.duplicate(true), "world": world.state(), "individuals": individuals.state(), "households": households.state(), "settlements": settlements.state(), "religion": religion.state(), "divine": divine.state(), "history": history.state()}

func import_state(data: Dictionary) -> Dictionary:
	if data.get("format", 0) != 1 or not data.get("rules", {}) is Dictionary or data.get("rules", {}).get("version", "") != "mvp0-2":
		return {"ok": false, "reason": "不支援的存檔版本。"}
	for key in ["scenario", "scheduled", "world", "individuals", "households", "settlements", "religion", "divine", "history"]:
		if not data.get(key, null) is Dictionary: return {"ok": false, "reason": "存檔缺少必要的狀態：%s。" % key}
	if not data.get("time", null) is int or not data.get("rng_state", null) is int or not data.get("command_log", null) is Array:
		return {"ok": false, "reason": "存檔缺少時鐘或重播狀態。"}
	rules = data.rules.duplicate(true)
	scenario = data.scenario.duplicate(true)
	time = data.time
	rng.state = data.rng_state
	scheduled = data.scheduled.duplicate()
	command_log = data.command_log.duplicate(true)
	for system in ["world", "individuals", "households", "settlements", "religion", "divine", "history"]:
		get(system).restore(data[system])
	history.limit = int(rules.history_limit)
	wall_remainder = 0.0
	return {"ok": true, "reason": "存檔已載入。"}

func save_file(path: String) -> Dictionary:
	var file = FileAccess.open(path, FileAccess.WRITE)
	if not file: return {"ok": false, "reason": "無法寫入存檔：%s" % error_string(FileAccess.get_open_error())}
	file.store_var(export_state())
	return {"ok": true, "reason": "世界已保存。"}

func load_file(path: String) -> Dictionary:
	var file = FileAccess.open(path, FileAccess.READ)
	if not file: return {"ok": false, "reason": "尚無存檔。"}
	var data = file.get_var(false)
	if not data is Dictionary: return {"ok": false, "reason": "存檔格式損毀。"}
	return import_state(data)

func scheduler_backlog() -> int:
	var due = 0
	for value in scheduled.values(): due += int(int(value) <= time)
	due += int(world.next_deadline() <= time)
	due += int(religion.next_deadline(self) <= time)
	due += int(individuals.next_deadline() <= time)
	return due
