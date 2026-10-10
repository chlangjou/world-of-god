extends RefCounted

var id: String = "god.river"
var dp: float = 0.0
var last_accrual: int = 0
var skills: Dictionary = {"rain": {"mastery": 1, "xp": 0.0, "cooldown_until": 0}}

func start(s) -> void:
	dp = float(s.scenario.initial_dp)
	last_accrual = 0
	skills = {"rain": {"mastery": 1, "xp": 0.0, "cooldown_until": 0}}

static func devotion_weight(devotion: float) -> int:
	if devotion < 20.0: return 0
	if devotion < 40.0: return 1
	if devotion < 80.0: return 2
	if devotion < 90.0: return 4
	return 8

func rate(s) -> float:
	var weight = 0
	for p in s.individuals.people:
		if p.alive and p.religion_id == s.religion.id: weight += devotion_weight(p.devotion)
	return float(s.rules.natural_dp_per_day) + weight * float(s.rules.worship_dp_per_weight_day)

func accrue(s) -> void:
	if s.time <= last_accrual: return
	dp = minf(float(s.rules.dp_cap), dp + rate(s) * float(s.time - last_accrual) / s.day_seconds())
	last_accrual = s.time

func projected_dp(s) -> float:
	return minf(float(s.rules.dp_cap), dp + rate(s) * float(s.time - last_accrual) / s.day_seconds())

func presence(s, center: Vector2) -> Dictionary:
	var weighted = 0.0
	var radius = float(s.rules.presence_radius)
	for p in s.individuals.people:
		if not p.alive or p.religion_id != s.religion.id: continue
		var distance = center.distance_to(Vector2(p.x, p.y))
		if distance >= radius: continue
		weighted += devotion_weight(p.devotion) * (1.0 - distance / radius)
	return {"weighted": weighted, "density": weighted / (PI * radius * radius), "dominance": 1.0 if weighted > 0.0 else 0.0}

func evaluate(s, command: Dictionary) -> Dictionary:
	var x = command.get("x", -1.0)
	var y = command.get("y", -1.0)
	var radius = command.get("radius", s.rules.rain_standard_radius)
	var intensity = command.get("intensity", 1.0)
	var days = command.get("days", s.rules.rain_standard_days)
	for value in [x, y, radius, intensity, days]:
		if not (value is float or value is int) or not is_finite(float(value)): return {"ok": false, "reason": "降雨參數必須是有限數值。", "cost": 0.0, "cooldown_days": 0.0, "presence": {"weighted": 0.0}}
	var sample = presence(s, Vector2(x, y))
	var workload = pow(float(radius) / float(s.rules.rain_standard_radius), 2.0) * float(intensity) * float(days) / float(s.rules.rain_standard_days)
	var efficiency = 1.0 + (skills.rain.mastery - 1) * 0.3
	var cost = maxf(1.0, float(s.rules.rain_standard_cost) * workload / efficiency)
	var cooldown_days = maxf(float(s.rules.rain_min_cooldown_days), float(s.rules.rain_cooldown_days) * minf(1.4, maxf(0.3, sqrt(maxf(0.0, workload)))) / efficiency)
	var reason = "可以施放；收穫仍取決於土地與居民勞動。"
	var ok = true
	if x < 0.0 or y < 0.0 or x >= s.world.size or y >= s.world.size:
		ok = false
		reason = "施放中心超出河谷範圍。"
	elif radius < float(s.rules.rain_radius_min) or radius > float(s.rules.rain_radius_max) or intensity < float(s.rules.rain_intensity_min) or intensity > float(s.rules.rain_intensity_max) or days < 1 or days > int(s.rules.rain_max_days):
		ok = false
		reason = "超出目前 PoC 支援的低階降雨範圍（最長一個月）。"
	elif sample.weighted < float(s.rules.rain_min_presence):
		ok = false
		reason = "中心附近缺少信仰臨在；儲存神力不能取代當地信仰。"
	elif skills.rain.cooldown_until > s.time:
		ok = false
		reason = "降雨仍在冷卻，剩餘 %.1f 天。" % (float(skills.rain.cooldown_until - s.time) / s.day_seconds())
	elif projected_dp(s) + 0.00001 < cost:
		ok = false
		reason = "神力不足，需要 %.1f DP。" % cost
	return {"ok": ok, "reason": reason, "cost": cost, "cooldown_days": cooldown_days, "presence": sample, "x": x, "y": y, "radius": radius, "intensity": intensity, "days": days}

func cast(s, command: Dictionary) -> Dictionary:
	var result = evaluate(s, command)
	if not result.ok: return result
	dp -= result.cost
	skills.rain.cooldown_until = s.time + int(result.cooldown_days * s.day_seconds())
	skills.rain.xp += result.cost
	skills.rain.mastery = mini(5, 1 + int(skills.rain.xp / float(s.rules.rain_mastery_xp_threshold)))
	var event_id = s.record("rain", "你在 (%d, %d) 降下雨，半徑 %.0f，持續 %.0f 天，耗用 %.1f DP。" % [result.x, result.y, result.radius, result.days, result.cost], [id], [], {"center": [result.x, result.y], "presence_at_center": result.presence.weighted, "intensity": result.intensity})
	s.world.apply_rain({"x": result.x, "y": result.y, "radius": result.radius, "intensity": result.intensity, "started_at": s.time, "expires_at": s.time + int(result.days * s.day_seconds()), "event_id": event_id, "growth_recorded": false})
	result.event_id = event_id
	return result

func view(s) -> Dictionary:
	var data = state()
	data.dp = projected_dp(s)
	data.rate = rate(s)
	data.cap = s.rules.dp_cap
	return data

func state() -> Dictionary:
	return {"id": id, "dp": dp, "last_accrual": last_accrual, "skills": skills.duplicate(true)}

func restore(data: Dictionary) -> void:
	for key in data: set(key, data[key].duplicate(true) if data[key] is Dictionary else data[key])
