extends RefCounted

# Observation pacing only. The simulation still processes every scheduled update.
const DAY_START_HOUR = 8
const NIGHT_START_HOUR = 20
const NIGHT_MULTIPLIER = 8
const RESUME_GRACE_SECONDS = 10.0
const NIGHT_EVENTS = [
	"birth", "death", "pregnancy", "migration", "settlement", "shortage",
	"saint", "priest", "prayer_fulfilled", "rain", "rain_ended",
	"oracle_issued", "oracle_outcome", "oracle_expired", "oracle_terminated", "oracle_concluded"
]

var night_skip_enabled: bool = true
var fractional_seconds: float = 0.0
var observed_next_id: int = 1
var grace_remaining: float = 0.0

func reset(s) -> void:
	fractional_seconds = 0.0
	observed_next_id = s.history.next_id
	grace_remaining = 0.0

func resumed() -> void:
	grace_remaining = RESUME_GRACE_SECONDS

func is_daytime(s, at_time: int = -1) -> bool:
	var within_day = (s.time if at_time < 0 else at_time) % s.day_seconds()
	return within_day >= s.day_seconds() * DAY_START_HOUR / 24 and within_day < s.day_seconds() * NIGHT_START_HOUR / 24

func multiplier(s) -> int:
	return NIGHT_MULTIPLIER if night_skip_enabled and not is_daytime(s) else 1

func next_phase_time(s) -> int:
	var within_day = s.time % s.day_seconds()
	var day_start = s.time - within_day
	var morning = s.day_seconds() * DAY_START_HOUR / 24
	var evening = s.day_seconds() * NIGHT_START_HOUR / 24
	if within_day < morning: return day_start + morning
	if within_day < evening: return day_start + evening
	return day_start + s.day_seconds() + morning

func take_night_event(s) -> Dictionary:
	var found: Dictionary = {}
	for event in s.history.events:
		if event.id < observed_next_id: continue
		if grace_remaining <= 0.0 and night_skip_enabled and not is_daytime(s, event.time) and event.kind in NIGHT_EVENTS:
			found = event.duplicate(true)
			break
	observed_next_id = s.history.next_id
	return found

func advance_wall(s, delta: float) -> Dictionary:
	if s.paused or delta <= 0.0: return {}
	var event = take_night_event(s)
	if not event.is_empty(): return event
	var remaining_wall = delta
	while remaining_wall > 0.0:
		var rate = float(s.day_seconds()) / float(s.rules.wall_seconds_per_day) * s.speed * multiplier(s)
		var wall_budget = minf(remaining_wall, grace_remaining) if grace_remaining > 0.0 else remaining_wall
		var available = wall_budget * rate + fractional_seconds
		# Avoid losing an integer second to roundoff when a frame crosses 08:00.
		var seconds = int(available + 0.000001)
		if seconds == 0:
			fractional_seconds = available
			remaining_wall = maxf(0.0, remaining_wall - wall_budget)
			grace_remaining = maxf(0.0, grace_remaining - wall_budget)
			continue
		# Bound each step by a real scheduler deadline and the day/night boundary.
		# This lets a birth at 01:00 stop the view at 01:00, even at 16x.
		var target = mini(s.time + seconds, mini(next_phase_time(s), s.next_update_time()))
		var elapsed_wall = (float(target - s.time) - fractional_seconds) / rate
		fractional_seconds = 0.0
		s.advance_to(target)
		remaining_wall = maxf(0.0, remaining_wall - elapsed_wall)
		grace_remaining = maxf(0.0, grace_remaining - elapsed_wall)
		event = take_night_event(s)
		if not event.is_empty(): return event
	return {}
