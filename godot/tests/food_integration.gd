extends SceneTree

const Session = preload("res://scripts/simulation/session.gd")
var checks: int = 0
var failures: int = 0
var evidence: Array = []

func check(condition: bool, description: String) -> void:
	checks += 1
	if condition: print("FOOD PASS: ", description)
	else:
		failures += 1
		push_error("FOOD FAIL: " + description)

func fresh():
	var s = Session.new()
	s.start()
	s.advance_by(s.day_seconds())
	return s

func set_food(s, private_stock: float, public_stock: float) -> void:
	# Controlled resource fixture, not a production rule or repeating subsidy.
	for home in s.households.homes: home.inventory.food = private_stock
	for town in s.settlements.towns: town.storage.food = public_stock
	s.households.initial.food = s.households.total_item("food") + s.settlements.total_item("food")
	s.households.output.food = 0.0
	s.households.consumed = 0.0

func food_conserved(s) -> bool:
	return absf(s.households.initial.food + s.households.output.food - s.households.consumed - s.stats().food) < 0.0001

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var shared = fresh()
	set_food(shared, 0.0, 100.0)
	var planning_before = var_to_bytes(shared.export_state())
	var access = shared.households.food_access_view(shared)
	var planned = 0.0
	for entry in access.values(): planned += entry.shared
	check(is_equal_approx(planned, 100.0) and var_to_bytes(shared.export_state()) == planning_before, "N: communal planning shares conserve stock without consuming or reserving it")
	shared.households.consume(shared)
	var all_fed = true
	for home in shared.households.homes: all_fed = all_fed and is_equal_approx(home.satisfaction, 1.0)
	check(all_fed and shared.settlements.towns[0].storage.food < 100.0 and food_conserved(shared), "N: zero-private-store households actually consume eligible shared food")
	var remote = shared.households.get_home(1)
	var original = Vector2(remote.x, remote.y)
	check(shared.households.relocate(shared, 1, Vector2(8, 6)) and remote.settlement_id == 0 and 1 not in shared.settlements.towns[0].households and shared.individuals.get_person(1).settlement_id == 0, "N: migration out updates household, individuals and settlement membership")
	# Even stale membership on both sides must not bypass actual physical access.
	remote.settlement_id = 1
	shared.settlements.towns[0].households.append(1)
	var public_before = shared.settlements.towns[0].storage.food
	check(shared.households.accessible_food(shared, remote) == 0.0 and shared.settlements.allocate_food(shared, 1, [{"household_id": 1, "amount": 5.0}]).is_empty() and shared.settlements.towns[0].storage.food == public_before, "N: distance blocks phantom reserves and unauthorized withdrawal despite stale membership")
	var private_wood = remote.inventory.wood
	var public_wood = shared.settlements.towns[0].storage.wood
	shared.households.deposit_output(shared, 1, "wood", 10.0)
	check(is_equal_approx(remote.inventory.wood - private_wood, 10.0) and shared.settlements.towns[0].storage.wood == public_wood, "N: isolated output stays private instead of an unreachable deposit-only transfer")
	shared.households.consume(shared)
	shared.individuals.update_health(shared)
	check(remote.satisfaction == 0.0 and shared.individuals.get_person(1).hunger > 0.0 and food_conserved(shared), "N: real isolation creates hardship while nearby families still consume conservatively")
	check(shared.households.relocate(shared, 1, original) and remote.settlement_id == 1 and shared.individuals.get_person(1).settlement_id == 1 and shared.settlements.towns[0].households.count(1) == 1, "N: migration back reestablishes access and a single coherent membership")
	shared.households.consume(shared)
	check(is_equal_approx(remote.satisfaction, 1.0) and food_conserved(shared), "N: rejoined household can actually withdraw and consume again")
	var town = shared.settlements.towns[0]
	remote.x = town.x + 12.0
	remote.y = town.y
	check(shared.world.valid_land(remote.x, remote.y) and not shared.settlements.food_eligible(shared, 1, 1), "N: a river blocks direct food access even within nominal store radius")
	remote.x = original.x
	remote.y = original.y
	remote.settlement_id = 0
	check(shared.households.accessible_food(shared, remote) == remote.inventory.food, "N: proximity alone grants no communal stock to a nonmember")

	var ration = fresh()
	for id_value in [1, 2, 3]: ration.individuals.get_person(id_value).age = 8.0
	var daily_need = ration.households.daily_food_need(ration)
	set_food(ration, 0.0, daily_need * 0.25)
	access = ration.households.food_access_view(ration)
	var equal_coverage = true
	for entry in access.values(): equal_coverage = equal_coverage and is_equal_approx(entry.available / entry.need, 0.25)
	ration.households.consume(ration)
	var equal_rations = true
	for home in ration.households.homes: equal_rations = equal_rations and is_equal_approx(home.satisfaction, 0.25)
	check(equal_coverage and equal_rations and food_conserved(ration), "N: different dependent counts use real food needs for planning and shortage rations")

	var enough = fresh()
	set_food(enough, 0.0, 1000.0)
	town = enough.settlements.towns[0]
	town.project = {}
	town.storage.wood = 20.0
	town.storage.stone = 10.0
	town.storage.fiber = 10.0
	var p = enough.individuals.get_person(1)
	p.skills.agriculture = 1.0
	p.skills.gathering = 1.0
	var choice = enough.individuals.choose_activity(enough, p, enough.settlements.demand(enough, 1))
	check(choice.activity == "care" and choice.food_urgency == 0.0 and choice.reason.contains("糧食保障已足"), "O: even a highly skilled farmer chooses family care when food and materials are enough")
	enough.settlements.start_project(enough, town)
	choice = enough.individuals.choose_activity(enough, p, enough.settlements.demand(enough, 1))
	check(choice.activity == "build", "O: sufficient food allows feasible housing/storage work to take priority")
	set_food(enough, 0.0, 0.0)
	enough.households.get_home(1).inventory.food = 1000.0
	check(enough.settlements.demand(enough, 1).food > 0.7, "N: one family's private surplus cannot hide the other families' real deficits")
	enough.households.get_home(1).inventory.food = 0.0
	choice = enough.individuals.choose_activity(enough, p, enough.settlements.demand(enough, 1))
	check(choice.activity in ["farm", "gather_food"] and choice.food_urgency > 0.0, "O: actual food shortage restores food-work priority over construction")
	var oracle_enough = fresh()
	oracle_enough.advance_to(3 * oracle_enough.day_seconds())
	set_food(oracle_enough, 0.0, 1000.0)
	town = oracle_enough.settlements.towns[0]
	town.project = {}
	town.storage.wood = 20.0
	town.storage.stone = 10.0
	town.storage.fiber = 10.0
	p = oracle_enough.individuals.get_person(oracle_enough.religion.living_saints(oracle_enough)[0])
	var issued = oracle_enough.submit_command({"type": "oracle", "saint_id": p.id})
	choice = oracle_enough.individuals.choose_activity(oracle_enough, p, oracle_enough.settlements.demand(oracle_enough, 1))
	check(issued.ok and choice.activity == "care" and choice.calling.strength > 0.0 and choice.effective_calling == 0.0 and oracle_enough.religion.get_oracle(issued.oracle_id).status == "active", "O: an active food Oracle still permits other activity when its food need is already satisfied")

	var steady = fresh()
	var trajectory: Array = []
	for day in [30, 60, 90]:
		steady.advance_to(day * steady.day_seconds())
		trajectory.append({"day": day, "food": steady.stats().food, "coverage_days": steady.stats().food_days})
	check(steady.stats().population > 0 and steady.stats().food_days < 10.0 and steady.individuals.activity_counts.get("care", 0) > 0 and food_conserved(steady), "O: ordinary 90-day life maintains reserves and non-food activities without runaway hoarding")
	var noisy = false
	for event in steady.history.events: noisy = noisy or event.kind in ["construction", "construction_started", "daily", "food_balance", "no_event"]
	check(not noisy, "O: routine construction and empty resource summaries stay out of player History")
	evidence.append({"scenario": "default_food_trajectory", "seed": 1106, "trajectory": trajectory, "activities": steady.individuals.activity_counts, "stats": steady.stats()})

	var legacy = steady.export_state()
	legacy.rules.version = "mvp0-2"
	legacy.rules.erase("household_food_target_days")
	legacy.rules.erase("settlement_food_target_days")
	var migrated = Session.new()
	check(migrated.import_state(legacy).ok and migrated.rules.version == "mvp0-3" and var_to_bytes(migrated.export_state()) == var_to_bytes(steady.export_state()), "J: mvp0-2 saves upgrade without losing resources, people, RNG or pending events")

	var favorable = Session.new()
	favorable.start({"initial_food_per_household": 80.0}, 1106)
	var long_trajectory: Array = []
	for day in range(200, 1601, 200):
		favorable.advance_to(day * favorable.day_seconds())
		long_trajectory.append({"day": day, "stats": favorable.stats()})
		print("FOOD PROGRESS: favorable day ", day, ", births ", favorable.individuals.births, ", population ", favorable.stats().population)
	check(favorable.individuals.births > 0 and favorable.stats().population > 0 and food_conserved(favorable), "O: favorable 1600-day seeded life produces actual autonomous births with finite food and no forced target")
	var actual_parents = true
	for person in favorable.individuals.people:
		if person.born_at >= 0: actual_parents = actual_parents and person.parent_ids.size() == 2 and person.id in favorable.households.get_home(person.household_id).members
	check(actual_parents and favorable.history.events.size() <= favorable.rules.history_limit, "O: long-run births retain real parents and bounded History")
	evidence.append({"scenario": "favorable_1600_days", "seed": 1106, "preset": {"initial_food_per_household": 80.0}, "trajectory": long_trajectory, "stats": favorable.stats()})
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var file = FileAccess.open("res://test-output/food-integration.json", FileAccess.WRITE)
	file.store_string(JSON.stringify({"ruleset": favorable.rules.version, "checks": checks, "failures": failures, "evidence": evidence}, "\t"))
	print("FOOD RESULT: %d checks, %d failures" % [checks, failures])
	quit(1 if failures > 0 else 0)
