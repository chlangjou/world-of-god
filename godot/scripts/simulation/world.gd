extends RefCounted

var size: int = 64
var cells: Array = []
var effects: Array = []
var last_update: int = 0
var natural_input: float = 0.0
var weather: String = "乾燥"
var harvest_total: float = 0.0
var rain_bonus_harvest: float = 0.0

func start(s) -> void:
	size = int(s.scenario.map_size)
	cells.clear()
	effects.clear()
	last_update = 0
	harvest_total = 0.0
	rain_bonus_harvest = 0.0
	for y in size:
		for x in size:
			var river_x = size * 0.52 + sin(y * 0.16) * 3.0
			var river_distance = absf(x - river_x)
			var water = river_distance < 1.7
			var fertility = clampf(1.0 - river_distance / 34.0 + s.rng.randf_range(-0.12, 0.12), 0.12, 1.0)
			var terrain = "water" if water else ("forest" if s.rng.randf() < 0.16 else ("hill" if river_distance > 20.0 else "grass"))
			var moisture = float(s.scenario.initial_moisture) + (0.18 if river_distance < 5.0 else 0.0)
			cells.append({"x": x, "y": y, "terrain": terrain, "soil": fertility, "water_distance": river_distance, "moisture": moisture, "baseline_moisture": moisture, "crops": float(s.scenario.initial_crops) * fertility if not water else 0.0, "rain_bonus": 0.0, "crop_cause": 0, "wild_food": float(s.scenario.initial_wild_food) * fertility if not water else 0.0, "wood": 8.0 if terrain == "forest" else 0.5, "stone": 6.0 if terrain == "hill" else 0.4, "fiber": 1.4 if not water else 0.0})

func cell_at(x: int, y: int) -> Dictionary:
	if x < 0 or y < 0 or x >= size or y >= size: return {}
	return cells[y * size + x]

func valid_land(x: float, y: float) -> bool:
	var cell = cell_at(int(x), int(y))
	return not cell.is_empty() and cell.terrain != "water"

func next_deadline() -> int:
	var result = 9223372036854775807
	for effect in effects: result = mini(result, int(effect.expires_at))
	return result

func apply_rain(effect: Dictionary) -> void:
	effects.append(effect.duplicate(true))

func expire_effects(s) -> void:
	if effects.is_empty(): return
	if next_deadline() > s.time: return
	advance_conditions(s)
	for index in range(effects.size() - 1, -1, -1):
		if effects[index].expires_at <= s.time:
			s.record("rain_ended", "降雨停止了；土地保留已獲得的水分。", [], [effects[index].event_id])
			effects.remove_at(index)

func update(s) -> void:
	advance_conditions(s)
	natural_input = float(s.rules.natural_rain_input) if s.rng.randf() < float(s.rules.natural_rain_chance) else 0.0
	weather = "自然陣雨" if natural_input > 0.0 else ("神蹟降雨" if not effects.is_empty() else "乾燥")

func advance_conditions(s) -> void:
	if s.time <= last_update: return
	var days = float(s.time - last_update) / s.day_seconds()
	var causes: Dictionary = {}
	for cell in cells:
		if cell.terrain == "water": continue
		var river_supply = 0.018 if cell.water_distance < 5.0 else 0.0
		var base_change = (natural_input + river_supply - float(s.rules.evaporation_per_day)) * days
		cell.baseline_moisture = clampf(cell.baseline_moisture + base_change, 0.0, 1.0)
		var rain = 0.0
		var parent = 0
		for effect in effects:
			var overlap = maxi(0, mini(s.time, int(effect.expires_at)) - maxi(last_update, int(effect.started_at)))
			if overlap <= 0: continue
			if Vector2(cell.x, cell.y).distance_to(Vector2(effect.x, effect.y)) <= effect.radius:
				rain += float(s.rules.rain_input_per_day) * effect.intensity * float(overlap) / s.day_seconds()
				parent = effect.event_id
		cell.moisture = clampf(cell.moisture + base_change + rain, 0.0, 1.0)
		var actual_growth = growth(s, cell, cell.moisture) * days
		var baseline_growth = growth(s, cell, cell.baseline_moisture) * days
		var added = minf(actual_growth, maxf(0.0, float(s.rules.crop_capacity) - cell.crops))
		cell.crops += added
		var bonus = minf(added, maxf(0.0, actual_growth - baseline_growth))
		cell.rain_bonus = minf(cell.crops, cell.rain_bonus + bonus)
		if parent > 0 and bonus > 0.0001:
			causes[parent] = float(causes.get(parent, 0.0)) + bonus
			cell.crop_cause = parent
		cell.wild_food = minf(2.5 * cell.soil, cell.wild_food + float(s.rules.wild_food_regrowth) * days * cell.soil)
		cell.wood = minf(8.0 if cell.terrain == "forest" else 0.5, cell.wood + 0.002 * days)
		cell.fiber = minf(1.4, cell.fiber + 0.008 * days)
	for effect in effects:
		if causes.has(effect.event_id) and not effect.get("growth_recorded", false):
			var wet_event = s.record("moisture", "降雨增加了施放範圍內的土壤水分。", [], [effect.event_id])
			var crop_event = s.record("crop_growth", "較濕潤的土地帶來額外作物生長；仍需居民收穫。", [], [wet_event], {"marginal_crop_growth": causes[effect.event_id]})
			effect.growth_recorded = true
			for cell in cells:
				if cell.crop_cause == effect.event_id: cell.crop_cause = crop_event
	last_update = s.time

func growth(s, cell: Dictionary, moisture: float) -> float:
	var factor = 0.15 + moisture * 1.1
	if moisture > 0.85: factor *= maxf(0.08, 1.0 - (moisture - 0.85) * 6.0)
	return float(s.rules.crop_growth) * 4.0 * cell.soil * factor

func reachable(a: Vector2, b: Vector2) -> bool:
	var steps = maxi(1, int(ceil(a.distance_to(b) * 2.0)))
	for n in range(1, steps + 1):
		var point = a.lerp(b, float(n) / steps)
		if not valid_land(point.x, point.y): return false
	return true

func find_resource(pos: Vector2, item: String, radius: int = 5) -> Dictionary:
	var best: Dictionary = {}
	var best_score = -1.0
	for y in range(maxi(0, int(pos.y) - radius), mini(size, int(pos.y) + radius + 1)):
		for x in range(maxi(0, int(pos.x) - radius), mini(size, int(pos.x) + radius + 1)):
			var cell = cells[y * size + x]
			if cell.terrain == "water": continue
			var amount = float(cell.get(item, 0.0))
			if amount < 0.08: continue
			var distance = pos.distance_to(Vector2(x, y))
			var score = amount / (1.0 + distance * 0.3)
			if score > best_score and reachable(pos, Vector2(x, y)):
				best_score = score
				best = {"index": y * size + x, "x": x, "y": y, "amount": amount, "distance": distance}
	return best

func take_resource(index: int, item: String, maximum: float) -> Dictionary:
	var cell = cells[index]
	var taken = minf(maximum, maxf(0.0, cell.get(item, 0.0)))
	cell[item] -= taken
	var bonus = 0.0
	var cause = 0
	if item == "crops":
		bonus = minf(taken, cell.rain_bonus)
		cell.rain_bonus -= bonus
		cause = cell.crop_cause if bonus > 0.001 else 0
		harvest_total += taken
		rain_bonus_harvest += bonus
	return {"amount": taken, "rain_bonus": bonus, "cause": cause}

func state() -> Dictionary:
	return {"size": size, "cells": cells.duplicate(true), "effects": effects.duplicate(true), "last_update": last_update, "natural_input": natural_input, "weather": weather, "harvest_total": harvest_total, "rain_bonus_harvest": rain_bonus_harvest}

func restore(data: Dictionary) -> void:
	for key in data: set(key, data[key].duplicate(true) if data[key] is Array or data[key] is Dictionary else data[key])
