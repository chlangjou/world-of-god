extends RefCounted

var people: Array = []
var births: int = 0
var deaths: int = 0
var activity_counts: Dictionary = {}
var labor_hours: float = 0.0

func start(s) -> void:
	people.clear()
	births = 0
	deaths = 0
	labor_hours = 0.0
	activity_counts = {}
	var names = ["阿蘆", "禾青", "石川", "小芽", "雨桐", "林澤", "穗生", "小葵", "沐原", "青石", "梓木", "小溪", "望舒", "田安", "山禾", "小滿", "夏河", "秋木", "冬青", "小谷", "朝露", "夕禾", "白岩", "小萍", "若水", "高林", "安禾", "小榆", "知雨", "遠川", "竹生", "小葉"]
	for i in int(s.scenario.population):
		var home = s.households.get_home(i / int(s.scenario.household_size) + 1)
		var child = i % int(s.scenario.household_size) == int(s.scenario.household_size) - 1
		var age = s.rng.randf_range(5.0, 12.0) if child else s.rng.randf_range(20.0, 42.0)
		var believer = i % int(s.scenario.believer_every) == 0
		var skills = {"agriculture": s.rng.randf_range(0.3, 0.9), "gathering": s.rng.randf_range(0.4, 0.9), "construction": s.rng.randf_range(0.2, 0.8), "preaching": s.rng.randf_range(0.3, 0.9)}
		var p = make_person(s, i + 1, names[i % names.size()] + (str(i / names.size() + 1) if i >= names.size() else ""), home.id, age, home.x + s.rng.randf_range(-0.5, 0.5), home.y + s.rng.randf_range(-0.5, 0.5))
		p.skills = skills
		p.religion_id = "religion.river" if believer or i % 4 == 1 else ""
		p.devotion = float(s.scenario.initial_devotion) if believer else (28.0 if i % 4 == 1 else 0.0)
		p.receptivity = float(s.scenario.initial_receptivity) if believer else s.rng.randf_range(0.2, 0.7)
		p.profile.can_gestate = i % 4 == 0
		p.profile.can_fertilize = i % 4 == 1
		p.partner_id = i + 2 if i % 4 == 0 else (i if i % 4 == 1 else 0)
		p.occupation = "food_producer" if skills.agriculture >= skills.construction else "builder"
		people.append(p)
		s.households.add_member(home.id, p.id)

func make_person(s, id_value: int, person_name: String, household_id: int, age: float, x: float, y: float) -> Dictionary:
	return {"id": id_value, "name": person_name, "household_id": household_id, "settlement_id": 0, "x": x, "y": y, "born_at": -int(age * float(s.rules.year_days) * s.day_seconds()) + s.time, "age": age, "stage": "child" if age < float(s.rules.adult_age) else "adult", "alive": true, "health": 100.0, "hunger": 0.0, "effort": 0.0, "skills": {"agriculture": 0.1, "gathering": 0.1, "construction": 0.1, "preaching": 0.1}, "occupation": "dependent", "activity": "rest", "reason": "安頓家庭。", "decision": {}, "religion_id": "", "devotion": 0.0, "receptivity": 0.4, "partner_id": 0, "parent_ids": [], "profile": {"can_gestate": false, "can_fertilize": false, "fertility": 1.0, "gestation_days": int(s.rules.gestation_days), "recovery_days": int(s.rules.recovery_days)}, "pregnancy_due": 0, "pregnancy_partner": 0, "recovery_until": 0, "work_by_activity": {}, "death_event": 0}

func get_person(id_value: int) -> Dictionary:
	return people[id_value - 1] if id_value > 0 and id_value <= people.size() else {}

func join_settlement(s, home_id: int, town_id: int) -> void:
	for id_value in s.households.get_home(home_id).members: get_person(id_value).settlement_id = town_id

func relocate_household(s, home_id: int, target: Vector2) -> void:
	for id_value in s.households.get_home(home_id).members:
		var p = get_person(id_value)
		if p.alive:
			p.x = target.x
			p.y = target.y

func choose_activity(s, p: Dictionary, demand: Dictionary, access: Dictionary = {}) -> Dictionary:
	var home = s.households.get_home(p.household_id)
	if access.is_empty(): access = s.households.food_access_view(s)
	var pos = Vector2(p.x, p.y)
	var own_need = s.households.food_need(s, home)
	var food_days = s.households.accessible_food(s, home, access) / maxf(0.1, own_need)
	var pressure = s.religion.calling_pressure(s, p)
	var crop = s.world.find_resource(pos, "crops")
	var wild = s.world.find_resource(pos, "wild_food")
	var target_days = float(s.rules.household_food_target_days)
	var urgency = clampf(maxf(1.0 - food_days / target_days, float(demand.food)), 0.0, 1.0)
	var effective_calling = pressure.strength * urgency
	var food_score = maxf(0.0, target_days - food_days) + float(demand.food) * 3.0 + p.hunger * 0.045
	var context = "可用糧食 %.1f 天（家庭目標 %.1f）；公共缺口 %.2f；食物急迫 %.2f；神諭壓力 %.2f（實際 %.2f）。" % [food_days, target_days, demand.food, urgency, pressure.strength, effective_calling]
	var choices: Array = [{"activity": "care", "score": 0.8 + home.care_load * 0.1, "target": {}, "item": "", "reason": ("糧食保障已足，選擇照護家人與休息。" if urgency == 0.0 else "比較可行工作後，家庭照護更優先。") + context}]
	if not crop.is_empty():
		choices.append({"activity": "farm", "score": food_score + p.skills.agriculture * 1.5 * urgency + effective_calling, "target": crop, "item": "crops", "reason": context + "農耕能力 %.2f。" % p.skills.agriculture})
	if not wild.is_empty():
		choices.append({"activity": "gather_food", "score": food_score + p.skills.gathering * urgency + effective_calling * 0.8, "target": wild, "item": "wild_food", "reason": context + "附近可採食物；採集能力 %.2f。" % p.skills.gathering})
	var town = s.settlements.get_town(access[home.id].town_id)
	if not town.is_empty() and (not town.project.is_empty() or demand.maintenance > 0.02):
		choices.append({"activity": "build", "score": demand.housing * 3.0 + p.skills.construction * 1.6 + 1.0 + demand.maintenance, "target": {}, "item": "", "reason": context + "可施工／維護；住房需求 %.2f；建造能力 %.2f；維護需求 %.2f。" % [demand.housing, p.skills.construction, demand.maintenance]})
	if not town.is_empty():
		for item in ["wood", "stone", "fiber"]:
			if demand[item] <= 0.0: continue
			var resource = s.world.find_resource(pos, item, 6)
			if resource.is_empty(): continue
			choices.append({"activity": "gather_" + item, "score": 1.3 + demand[item] * 2.0 + p.skills.gathering + demand.housing * 0.4, "target": resource, "item": item, "reason": context + "%s需求 %.2f；採集能力 %.2f；住房需求 %.2f。" % [item, demand[item], p.skills.gathering, demand.housing]})
	var best = choices[0]
	for choice in choices:
		if choice.score > best.score: best = choice
	best = best.duplicate(true)
	best.calling = pressure
	best.food_days = food_days
	best.evaluated_at = s.time
	best.food_urgency = urgency
	best.effective_calling = effective_calling
	best.feasible_food = not crop.is_empty() or not wild.is_empty()
	best.scores = {}
	for choice in choices: best.scores[choice.activity] = choice.score
	return best

func update(s) -> void:
	var hour = int((s.time % s.day_seconds()) * 24 / s.day_seconds())
	var access = s.households.food_access_view(s)
	var demands = {}
	for town in s.settlements.towns: demands[town.id] = s.settlements.demand(s, town.id, access)
	for p in people:
		if not p.alive: continue
		if hour < 8:
			p.activity = "rest"
			p.reason = "在家庭住處休息，恢復體力。"
			p.effort = maxf(0.0, p.effort - 0.2)
			continue
		if p.age < float(s.rules.adult_age):
			p.activity = "care"
			p.reason = "依賴家人的照護，不提供成人勞力。"
			continue
		if hour >= 16:
			p.activity = "social"
			p.reason = "家庭生活、交流與聆聽。"
			var home = s.households.get_home(p.household_id)
			move_person(s, p, Vector2(home.x, home.y), 4.0)
			continue
		var demand = demands.get(access[p.household_id].town_id, {"food": 0.0, "housing": 0.0, "wood": 0.0, "stone": 0.0, "fiber": 0.0, "maintenance": 0.0, "trade": 0.0})
		var choice = choose_activity(s, p, demand, access)
		p.decision = choice.duplicate(true)
		p.activity = choice.activity
		p.reason = choice.reason
		var effort = clampf(p.health / 100.0, 0.15, 1.0) * (0.65 if p.age >= float(s.rules.elder_age) else 1.0)
		effort *= maxf(0.5, 1.0 - s.households.get_home(p.household_id).care_load * 0.05)
		p.effort = minf(1.0, p.effort + 0.16)
		activity_counts[p.activity] = int(activity_counts.get(p.activity, 0)) + 1
		if p.activity == "care": continue
		labor_hours += 4.0 * effort
		p.work_by_activity[p.activity] = float(p.work_by_activity.get(p.activity, 0.0)) + 4.0 * effort
		var production = {"amount": 0.0, "rain_bonus": 0.0, "cause": 0}
		if p.activity == "build":
			s.settlements.perform_work(s, p.settlement_id, p.id, effort * (0.7 + p.skills.construction))
			p.skills.construction = minf(1.0, p.skills.construction + 0.001)
		elif not choice.target.is_empty():
			var reached = move_person(s, p, Vector2(choice.target.x, choice.target.y), 3.0)
			if reached:
				var yield_value = float(s.rules.harvest_per_day) * (0.5 + p.skills.agriculture) if choice.item == "crops" else (float(s.rules.gather_food_per_day) * (0.5 + p.skills.gathering) if choice.item == "wild_food" else float(s.rules.gather_material_per_day) * (0.5 + p.skills.gathering))
				production = s.world.take_resource(choice.target.index, choice.item, yield_value * effort * 0.5)
				var inventory_item = "food" if choice.item in ["crops", "wild_food"] else choice.item
				s.households.deposit_output(s, p.household_id, inventory_item, production.amount)
				p.skills.agriculture = minf(1.0, p.skills.agriculture + 0.001) if p.activity == "farm" else p.skills.agriculture
				if production.cause > 0 and production.rain_bonus > 0.001:
					s.religion.note_food_evidence(s, p, production.amount, production.cause, "rain", production.rain_bonus)
		s.religion.note_decision(s, p, choice, production)
		if p.work_by_activity.get(p.activity, 0.0) >= 80.0:
			p.occupation = "food_producer" if p.activity in ["farm", "gather_food"] else ("builder" if p.activity == "build" else "gatherer")

func move_person(s, p: Dictionary, target: Vector2, distance: float) -> bool:
	var current = Vector2(p.x, p.y)
	var next = current.move_toward(target, distance)
	if s.world.reachable(current, next):
		p.x = next.x
		p.y = next.y
	return Vector2(p.x, p.y).distance_to(target) < 0.1

func update_health(s) -> void:
	for p in people:
		if not p.alive: continue
		var home = s.households.get_home(p.household_id)
		p.hunger = clampf(p.hunger + (1.0 - home.satisfaction) * 6.0 - home.satisfaction * 3.0, 0.0, 100.0)
		if p.hunger > 65.0: p.health -= (p.hunger - 65.0) * 0.045
		else: p.health = minf(100.0, p.health + 0.2 * home.satisfaction)
		if p.health <= 0.0: die(s, p.id, "長期嚴重糧食不足")

func adjust_devotion(person_id: int, religion_id: String, amount: float) -> void:
	var p = get_person(person_id)
	if p.is_empty() or not p.alive: return
	if p.religion_id.is_empty() and amount > 0.0: p.religion_id = religion_id
	if p.religion_id == religion_id: p.devotion = clampf(p.devotion + amount, 0.0, 100.0)

func die(s, person_id: int, cause: String) -> void:
	var p = get_person(person_id)
	if p.is_empty() or not p.alive: return
	p.alive = false
	p.activity = "dead"
	p.pregnancy_due = 0
	p.death_event = s.record("death", "%s離世，原因：%s。" % [p.name, cause], [p.id], [], {"cause": cause})
	deaths += 1
	s.religion.on_death(s, p.id, p.death_event)

func next_deadline() -> int:
	var result = 9223372036854775807
	for p in people:
		if p.alive and p.pregnancy_due > 0: result = mini(result, int(p.pregnancy_due))
	return result

func process_births(s) -> void:
	var due: Array = []
	for p in people:
		if p.alive and p.pregnancy_due > 0 and p.pregnancy_due <= s.time: due.append(p.id)
	for id_value in due:
		var parent = get_person(id_value)
		var home = s.households.get_home(parent.household_id)
		var child = make_person(s, people.size() + 1, "新芽 %d" % (births + 1), home.id, 0.0, home.x, home.y)
		child.stage = "infant"
		child.parent_ids = [parent.id, parent.pregnancy_partner]
		child.settlement_id = home.settlement_id
		child.profile.can_gestate = s.rng.randf() < 0.5
		child.profile.can_fertilize = not child.profile.can_gestate
		people.append(child)
		s.households.add_member(home.id, child.id)
		parent.pregnancy_due = 0
		parent.recovery_until = s.time + int(parent.profile.recovery_days) * s.day_seconds()
		births += 1
		s.record("birth", "第 %d 戶迎來新生兒；照護與住房需求增加。" % home.id, [parent.id, child.id, home.id])

func demography(s) -> void:
	for p in people:
		if not p.alive: continue
		p.age = float(s.time - p.born_at) / (float(s.rules.year_days) * s.day_seconds())
		p.stage = "infant" if p.age < 2.0 else ("child" if p.age < float(s.rules.adult_age) else ("elder" if p.age >= float(s.rules.elder_age) else "adult"))
		if p.age >= float(s.rules.lifespan_years):
			die(s, p.id, "高齡")
	var access = s.households.food_access_view(s)
	for p in people:
		if not p.alive: continue
		if p.partner_id == 0 and p.age >= float(s.rules.reproduction_min_age):
			# Bounded, local opportunity; exclude siblings and existing partners.
			for candidate_id in s.households.get_home(p.household_id).members:
				var candidate = get_person(candidate_id)
				if candidate.id == p.id or not candidate.alive or candidate.partner_id > 0 or candidate.age < float(s.rules.reproduction_min_age): continue
				if not p.parent_ids.is_empty() and p.parent_ids == candidate.parent_ids: continue
				if p.profile.can_gestate == candidate.profile.can_gestate: continue
				p.partner_id = candidate.id
				candidate.partner_id = p.id
				break
		if not p.profile.can_gestate or p.partner_id == 0 or p.pregnancy_due > 0 or p.recovery_until > s.time: continue
		if p.age < float(s.rules.reproduction_min_age) or p.age > float(s.rules.reproduction_max_age): continue
		var partner = get_person(p.partner_id)
		if partner.is_empty() or not partner.alive or not partner.profile.can_fertilize: continue
		var home = s.households.get_home(p.household_id)
		var security = clampf(s.households.accessible_food(s, home, access) / maxf(1.0, s.households.food_need(s, home) * 4.0), 0.0, 1.0)
		var housing = 1.0 if home.dwelling_id > 0 else 0.15
		var chance = float(s.rules.conception_monthly_chance) * security * housing * (p.health / 100.0) * p.profile.fertility / (1.0 + home.care_load * 0.25)
		if s.rng.randf() < chance:
			p.pregnancy_due = s.time + int(p.profile.gestation_days) * s.day_seconds()
			p.pregnancy_partner = partner.id
			s.record("pregnancy", "第 %d 戶在食物、伴侶與居住條件允許下，開始孕育新生命。" % home.id, [p.id, partner.id], [], {"food_security": security, "housing": housing, "chance": chance})

func state() -> Dictionary:
	return {"people": people.duplicate(true), "births": births, "deaths": deaths, "activity_counts": activity_counts.duplicate(), "labor_hours": labor_hours}

func restore(data: Dictionary) -> void:
	for key in data: set(key, data[key].duplicate(true) if data[key] is Array or data[key] is Dictionary else data[key])
