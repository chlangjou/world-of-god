extends RefCounted

var homes: Array = []
var consumed: float = 0.0
var migrations: int = 0
var initial: Dictionary = {}
var output: Dictionary = {}

func start(s) -> void:
	homes.clear()
	consumed = 0.0
	migrations = 0
	initial = {"food": 0.0, "wood": 0.0, "stone": 0.0, "fiber": 0.0}
	output = initial.duplicate()
	var count = int(ceil(float(s.scenario.population) / float(s.scenario.household_size)))
	for i in count:
		var inventory = {"food": float(s.scenario.initial_food_per_household), "wood": float(s.scenario.initial_wood_per_household), "stone": float(s.scenario.initial_stone_per_household), "fiber": float(s.scenario.initial_fiber_per_household)}
		for item in inventory: initial[item] += inventory[item]
		homes.append({"id": i + 1, "members": [], "x": 21.0 + (i % 4) * 2.0, "y": 24.0 + (i / 4 % 8) * 3.0, "inventory": inventory, "dwelling_id": 0, "settlement_id": 0, "shortage_days": 0, "satisfaction": 1.0, "relocated_at": -1, "care_load": 0, "last_evidence": 0})

func get_home(id_value: int) -> Dictionary:
	return homes[id_value - 1] if id_value > 0 and id_value <= homes.size() else {}

func add_member(household_id: int, person_id: int) -> void:
	get_home(household_id).members.append(person_id)

func join_settlement(household_id: int, settlement_id: int) -> void:
	get_home(household_id).settlement_id = settlement_id

func assign_dwelling(household_id: int, dwelling_id: int) -> void:
	get_home(household_id).dwelling_id = dwelling_id

func take(household_id: int, item: String, requested: float) -> float:
	var inventory = get_home(household_id).inventory
	var amount = minf(maxf(0.0, requested), inventory[item])
	inventory[item] -= amount
	return amount

func deposit_output(s, household_id: int, item: String, amount: float) -> void:
	if amount <= 0.0: return
	output[item] += amount
	var home = get_home(household_id)
	var town = s.settlements.get_town(home.settlement_id)
	if not s.settlements.food_eligible(s, home.settlement_id, home.id): town = {}
	var retained = amount if town.is_empty() else amount * float(s.rules.household_output_share)
	home.inventory[item] += retained
	if not town.is_empty(): s.settlements.deposit(town.id, item, amount - retained)

func total_item(item: String) -> float:
	var total = 0.0
	for home in homes: total += home.inventory[item]
	return total

func food_need(s, home: Dictionary) -> float:
	var result = 0.0
	for id_value in home.members:
		var p = s.individuals.get_person(id_value)
		if p.alive: result += float(s.rules.food_per_child) if p.age < float(s.rules.adult_age) else float(s.rules.food_per_adult)
	return result

func daily_food_need(s) -> float:
	var result = 0.0
	for home in homes: result += food_need(s, home)
	return result

func food_access_view(s) -> Dictionary:
	# Planning shares do not move or reserve inventory. Their sum never exceeds
	# real communal stock, and larger dependent households receive larger shares.
	var access: Dictionary = {}
	var groups: Dictionary = {}
	for home in homes:
		var need = food_need(s, home)
		var town_id = home.settlement_id if s.settlements.food_eligible(s, home.settlement_id, home.id) else 0
		access[home.id] = {"need": need, "own": home.inventory.food, "shared": 0.0, "available": home.inventory.food, "town_id": town_id}
		if town_id > 0 and need > 0.0:
			if not groups.has(town_id): groups[town_id] = {"need": 0.0, "homes": []}
			groups[town_id].need += need
			groups[town_id].homes.append(home.id)
	for town_id in groups:
		var group = groups[town_id]
		var stock = s.settlements.get_town(town_id).storage.food
		for home_id in group.homes:
			access[home_id].shared = stock * access[home_id].need / group.need
			access[home_id].available += access[home_id].shared
	return access

func accessible_food(s, home: Dictionary, access: Dictionary = {}) -> float:
	if access.is_empty(): access = food_access_view(s)
	return access[home.id].available

func consume(s) -> void:
	# First consume household goods, then ask the actual common store for deficits.
	var requests: Dictionary = {}
	var supplied: Dictionary = {}
	var access = food_access_view(s)
	for home in homes:
		var need = food_need(s, home)
		var own = take(home.id, "food", need)
		consumed += own
		supplied[home.id] = own
		if need > own and access[home.id].town_id > 0:
			if not requests.has(home.settlement_id): requests[home.settlement_id] = []
			requests[home.settlement_id].append({"household_id": home.id, "amount": need - own})
	for town_id in requests:
		var allocation = s.settlements.allocate_food(s, town_id, requests[town_id])
		for home_id in allocation:
			supplied[home_id] += allocation[home_id]
			consumed += allocation[home_id]
	for home in homes:
		var need = food_need(s, home)
		home.satisfaction = supplied[home.id] / need if need > 0.0 else 1.0
		home.care_load = 0
		for id_value in home.members:
			var p = s.individuals.get_person(id_value)
			if p.alive and p.age < float(s.rules.adult_age): home.care_load += 1
		if home.satisfaction < 0.85:
			home.shortage_days += 1
			if home.shortage_days == 3: s.record("shortage", "第 %d 戶開始節制口糧，增加尋找食物的優先序。" % home.id, [home.id], [], {"satisfaction": home.satisfaction})
		else: home.shortage_days = maxi(0, home.shortage_days - 1)

func relocate(s, household_id: int, target: Vector2) -> bool:
	if not s.world.valid_land(target.x, target.y): return false
	var home = get_home(household_id)
	if home.is_empty(): return false
	var previous = Vector2(home.x, home.y)
	home.x = target.x
	home.y = target.y
	home.relocated_at = s.time
	home.dwelling_id = 0
	home.shortage_days = 0
	s.settlements.reaffiliate(s, household_id)
	migrations += 1
	s.individuals.relocate_household(s, household_id, target)
	s.record("migration", "第 %d 戶因食物與居住壓力搬到河谷的另一處。" % household_id, [household_id], [], {"from": [previous.x, previous.y], "to": [target.x, target.y]})
	return true

func demography(s) -> void:
	for home in homes:
		if home.shortage_days < int(s.rules.relocation_shortage_days): continue
		var resource = s.world.find_resource(Vector2(home.x, home.y), "crops", 12)
		if not resource.is_empty(): relocate(s, home.id, Vector2(resource.x, resource.y))

func state() -> Dictionary:
	return {"homes": homes.duplicate(true), "consumed": consumed, "migrations": migrations, "initial": initial.duplicate(), "output": output.duplicate()}

func restore(data: Dictionary) -> void:
	for key in data: set(key, data[key].duplicate(true) if data[key] is Array or data[key] is Dictionary else data[key])
