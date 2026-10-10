extends RefCounted

var towns: Array = []
var spent_materials: Dictionary = {"food": 0.0, "wood": 0.0, "stone": 0.0, "fiber": 0.0}
var work_total: float = 0.0
var next_structure_id: int = 1

func start(_s) -> void:
	towns.clear()
	spent_materials = {"food": 0.0, "wood": 0.0, "stone": 0.0, "fiber": 0.0}
	work_total = 0.0
	next_structure_id = 1

func get_town(id_value: int) -> Dictionary:
	return towns[id_value - 1] if id_value > 0 and id_value <= towns.size() else {}

func deposit(id_value: int, item: String, amount: float) -> void:
	get_town(id_value).storage[item] += maxf(0.0, amount)

func take(id_value: int, item: String, requested: float) -> float:
	var store = get_town(id_value).storage
	var amount = minf(maxf(0.0, requested), store[item])
	store[item] -= amount
	return amount

func total_item(item: String) -> float:
	var result = 0.0
	for town in towns: result += town.storage[item]
	return result

func allocate_food(town_id: int, requests: Array) -> Dictionary:
	var total = 0.0
	for request in requests: total += request.amount
	var available = take(town_id, "food", total)
	var result = {}
	for request in requests: result[request.household_id] = available * request.amount / maxf(0.0001, total)
	return result

func try_form(s) -> void:
	if not towns.is_empty(): return
	var candidates: Array = []
	var center = Vector2.ZERO
	var wood = 0.0
	var fiber = 0.0
	var anchor = Vector2(s.households.homes[0].x, s.households.homes[0].y)
	for home in s.households.homes:
		if home.settlement_id > 0: continue
		if Vector2(home.x, home.y).distance_to(anchor) > float(s.rules.settlement_cluster_radius): continue
		var cell = s.world.cell_at(int(home.x), int(home.y))
		if cell.is_empty() or cell.soil < 0.3 or cell.water_distance > 17.0: continue
		candidates.append(home.id)
		center += Vector2(home.x, home.y)
		wood += home.inventory.wood
		fiber += home.inventory.fiber
	if candidates.size() < int(s.rules.settlement_min_households) or wood < float(s.rules.settlement_min_wood) or fiber < float(s.rules.settlement_min_fiber): return
	center /= candidates.size()
	var town = {"id": towns.size() + 1, "name": "蘆灣", "x": center.x, "y": center.y, "households": candidates, "storage": {"food": 0.0, "wood": 0.0, "stone": 0.0, "fiber": 0.0}, "structures": [], "project": {}, "basic_demand": {}, "trade_demand": 0.0, "shortage": "normal", "formed_at": s.time}
	towns.append(town)
	for home_id in candidates:
		s.households.join_settlement(home_id, town.id)
		s.individuals.join_settlement(s, home_id, town.id)
		# Voluntary founding contributions are transfers, not newly produced goods.
		for item in ["wood", "fiber", "stone"]:
			deposit(town.id, item, s.households.take(home_id, item, 2.0 if item == "wood" else 1.0))
	s.record("settlement", "居民因鄰近水源、家庭聚集與居住需求，自主組成「蘆灣」。", candidates, [], {"households": candidates.size(), "available_wood": wood, "available_fiber": fiber})

func demand(s, town_id: int) -> Dictionary:
	var town = get_town(town_id)
	if town.is_empty(): return {"food": 1.0, "housing": 1.0, "wood": 0.0, "stone": 0.0, "fiber": 0.0, "maintenance": 0.0, "trade": 0.0}
	var need = 0.0
	var stock = town.storage.food
	var unhoused = 0
	for id_value in town.households:
		var home = s.households.get_home(id_value)
		need += s.households.food_need(s, home)
		stock += home.inventory.food
		unhoused += int(home.dwelling_id == 0)
	var result = {"food": clampf(1.0 - stock / maxf(1.0, need * 6.0), 0.0, 1.0), "housing": float(unhoused) / maxf(1.0, town.households.size()), "wood": float(town.storage.wood < 12.0), "stone": float(town.storage.stone < 5.0), "fiber": float(town.storage.fiber < 5.0), "maintenance": 0.0, "trade": 0.0}
	for building in town.structures: result.maintenance = maxf(result.maintenance, 1.0 - building.condition / 100.0)
	return result

func start_project(s, town: Dictionary) -> void:
	if not town.project.is_empty(): return
	var kind = "storage" if town.structures.is_empty() else "housing"
	var home_id = 0
	if kind == "housing":
		for id_value in town.households:
			if s.households.get_home(id_value).dwelling_id == 0:
				home_id = id_value
				break
		if home_id == 0: return
	var recipe = s.rules.storage_recipe if kind == "storage" else s.rules.housing_recipe
	for item in recipe:
		if town.storage[item] < float(recipe[item]): return
	for item in recipe:
		var spent = take(town.id, item, float(recipe[item]))
		spent_materials[item] += spent
	var event = s.record("construction_started", "居民投入材料，開始建造%s。" % ("共用倉庫" if kind == "storage" else "家庭住宅"), [town.id], [], {"recipe": recipe})
	town.project = {"kind": kind, "household_id": home_id, "work": 0.0, "required_work": float(s.rules.storage_work if kind == "storage" else s.rules.housing_work), "started_at": s.time, "event_id": event}

func perform_work(s, town_id: int, person_id: int, effort: float) -> float:
	var town = get_town(town_id)
	if town.is_empty(): return 0.0
	if town.project.is_empty():
		for building in town.structures:
			if building.condition < 98.0:
				building.condition = minf(100.0, building.condition + effort * 3.0)
				work_total += effort
				return effort
		return 0.0
	var used = minf(effort, town.project.required_work - town.project.work)
	town.project.work += used
	work_total += used
	if town.project.work >= town.project.required_work - 0.0001:
		var project = town.project
		var building = {"id": next_structure_id, "kind": project.kind, "household_id": project.household_id, "condition": 100.0, "built_at": s.time, "x": town.x, "y": town.y}
		if project.household_id > 0:
			var home = s.households.get_home(project.household_id)
			building.x = home.x
			building.y = home.y
			s.households.assign_dwelling(home.id, building.id)
		next_structure_id += 1
		town.structures.append(building)
		town.project = {}
		s.record("construction", "%s落成：消耗材料與 %.1f 單位真實勞動。" % ["共用倉庫" if project.kind == "storage" else "第 %d 戶住宅" % project.household_id, project.required_work], [town.id, person_id], [project.event_id])
	return used

func update(s) -> void:
	try_form(s)
	for town in towns:
		for building in town.structures: building.condition = maxf(0.0, building.condition - float(s.rules.maintenance_per_day))
		start_project(s, town)
		town.basic_demand = demand(s, town.id)
		town.shortage = "severe" if town.basic_demand.food > 0.95 else ("shortage" if town.basic_demand.food > 0.7 else "normal")

func state() -> Dictionary:
	return {"towns": towns.duplicate(true), "spent_materials": spent_materials.duplicate(), "work_total": work_total, "next_structure_id": next_structure_id}

func restore(data: Dictionary) -> void:
	for key in data: set(key, data[key].duplicate(true) if data[key] is Array or data[key] is Dictionary else data[key])
