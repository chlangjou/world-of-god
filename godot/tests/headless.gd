extends SceneTree

const Session = preload("res://scripts/simulation/session.gd")
const Divine = preload("res://scripts/simulation/divine.gd")
var failures: int = 0
var checks: int = 0
var evidence: Array = []

func check(condition: bool, description: String) -> void:
	checks += 1
	if condition: print("PASS: ", description)
	else:
		failures += 1
		push_error("FAIL: " + description)

func fresh(preset: Dictionary = {}, overrides: Dictionary = {}):
	var sim = Session.new()
	sim.start(preset, 1106, overrides)
	return sim

func same(a, b) -> bool:
	return var_to_bytes(a.export_state()) == var_to_bytes(b.export_state())

func rain_command() -> Dictionary:
	return {"type": "rain", "x": 24.0, "y": 26.0, "radius": 9.0, "intensity": 1.0, "days": 12}

func invariants(sim) -> void:
	var valid = true
	for p in sim.individuals.people:
		var home = sim.households.get_home(p.household_id)
		valid = valid and not home.is_empty() and p.id in home.members and p.devotion >= 0 and p.devotion <= 100
	for home in sim.households.homes:
		for id_value in home.members: valid = valid and sim.individuals.get_person(id_value).household_id == home.id
		for item in home.inventory: valid = valid and home.inventory[item] >= -0.00001
	for town in sim.settlements.towns:
		for item in town.storage: valid = valid and town.storage[item] >= -0.00001
	check(valid, "A/C/D: valid entity references, membership and nonnegative inventories")
	for item in ["food", "wood", "stone", "fiber"]:
		var expected = sim.households.initial[item] + sim.households.output[item] - sim.settlements.spent_materials[item]
		if item == "food": expected -= sim.households.consumed
		check(absf(expected - sim.households.total_item(item) - sim.settlements.total_item(item)) < 0.0001, "C: conserved " + item)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var sim = fresh()
	check(sim.settlements.towns.is_empty(), "B: zero established settlements at Genesis")
	sim.advance_by(90 * sim.day_seconds())
	check(sim.stats().population > 0 and sim.individuals.activity_counts.has("farm") and sim.individuals.activity_counts.has("build"), "A: 90-day autonomous work and survival")
	check(sim.settlements.towns.size() == 1, "B: emergent river-valley settlement")
	check(sim.settlements.towns[0].structures.size() >= 2 and sim.settlements.work_total >= sim.rules.storage_work, "C: material/time/work-based housing and storage")
	invariants(sim)
	evidence.append({"scenario": "autonomous_90_days", "stats": sim.stats(), "activities": sim.individuals.activity_counts, "structures": sim.settlements.towns[0].structures.size()})
	var split = fresh({}, {"household_output_share": 0.35})
	split.advance_by(split.day_seconds())
	var hh = split.households.get_home(1).inventory.wood
	var store = split.settlements.get_town(1).storage.wood
	split.households.deposit_output(split, 1, "wood", 10.0)
	check(is_equal_approx(split.households.get_home(1).inventory.wood - hh, 3.5) and is_equal_approx(split.settlements.get_town(1).storage.wood - store, 6.5), "C: configurable new-output allocation")
	var deficit = fresh({"initial_food_per_household": 0.0, "initial_crops": 0.0, "initial_wild_food": 0.0}, {"crop_growth": 0.0, "wild_food_regrowth": 0.0})
	deficit.advance_by(10 * deficit.day_seconds())
	check(deficit.stats().hungry > 0 and deficit.stats().deaths == 0, "C: hardship before mortality, no conjured food")
	var demo = fresh()
	demo.individuals.get_person(1).pregnancy_due = 2 * demo.day_seconds() + 123
	demo.individuals.get_person(1).pregnancy_partner = 2
	demo.advance_to(2 * demo.day_seconds() + 123)
	check(demo.stats().population == 33 and demo.individuals.people[-1].age == 0 and demo.individuals.people[-1].id in demo.households.get_home(1).members, "D: exact-time real birth, parent/dependent membership")
	demo.individuals.get_person(3).born_at = -int(100 * demo.rules.year_days * demo.day_seconds())
	demo.advance_to(demo.month_seconds())
	check(demo.individuals.deaths == 1 and demo.stats().population == 32, "D: aging/death changes real living population")
	check(demo.households.relocate(demo, 1, Vector2(20, 35)) and demo.individuals.people[-1].x == 20, "D: household migration includes living dependents")
	invariants(demo)
	var rain = fresh()
	rain.advance_to(3 * rain.day_seconds())
	var dp = rain.divine.projected_dp(rain)
	var food = rain.stats().food
	var devotion = rain.individuals.get_person(1).devotion
	var estimate = rain.divine.evaluate(rain, rain_command())
	check(rain.submit_command(rain_command()).ok and is_equal_approx(rain.divine.dp, dp - estimate.cost), "E: valid Rain spends quoted global DP")
	check(rain.stats().food == food and rain.individuals.get_person(1).devotion == devotion, "E/F: no food creation or lasting faith reward at cast")
	dp = rain.divine.dp
	check(not rain.submit_command(rain_command()).ok and rain.divine.dp == dp, "E: cooldown rejection spends nothing")
	var moisture = rain.world.cell_at(24, 26).moisture
	rain.advance_by(rain.day_seconds())
	check(rain.world.cell_at(24, 26).moisture > moisture, "E: actual moisture responds to Rain")
	rain.advance_to(18 * rain.day_seconds())
	check(rain.world.effects.is_empty() and rain.world.rain_bonus_harvest > 0, "E: real Rain-derived harvest and automatic expiry")
	check(rain.world.cell_at(24, 26).moisture > 0, "E: expiry has no physical rollback")
	evidence.append({"scenario": "rain_day3_to18", "bonus_harvest": rain.world.rain_bonus_harvest, "actual_harvest": rain.world.harvest_total, "cost": estimate.cost})
	var invalid = fresh()
	dp = invalid.divine.dp
	var bad = rain_command()
	bad.days = 31
	check(not invalid.submit_command(bad).ok and invalid.divine.dp == dp, "E: duration beyond one month rejected before spending")
	bad = rain_command()
	bad.x = 60.0
	bad.y = 2.0
	check(not invalid.submit_command(bad).ok and invalid.divine.dp == dp, "E: center outside Presence cannot borrow area eligibility")
	bad = rain_command()
	bad.intensity = NAN
	check(not invalid.submit_command(bad).ok and invalid.divine.dp == dp, "E: nonfinite input rejected")
	var edge = rain_command()
	edge.radius = 14.0
	edge.days = 3
	check(invalid.submit_command(edge).ok, "E: valid center permits full area across low-Presence edges")
	var mastered = fresh()
	var novice = mastered.divine.evaluate(mastered, rain_command())
	mastered.divine.skills.rain.mastery = 3
	var better = mastered.divine.evaluate(mastered, rain_command())
	check(better.cost < novice.cost and better.cooldown_days < novice.cooldown_days, "E: independent mastery reduces DP and cooldown")
	check(mastered.world.growth(mastered, mastered.world.cell_at(24, 26), 1.0) < mastered.world.growth(mastered, mastered.world.cell_at(24, 26), 0.7), "E: saturated soil can reduce crops")
	check([Divine.devotion_weight(19), Divine.devotion_weight(20), Divine.devotion_weight(39), Divine.devotion_weight(40), Divine.devotion_weight(79), Divine.devotion_weight(80), Divine.devotion_weight(89), Divine.devotion_weight(90)] == [0, 1, 1, 2, 2, 4, 4, 8], "F: exact devotion contribution bands")
	var boundary = fresh()
	for p in boundary.individuals.people: p.devotion = 0.0
	boundary.individuals.get_person(1).devotion = 39
	check(boundary.stats().followers == 0, "F: 39 is not a follower")
	boundary.individuals.get_person(1).devotion = 40
	check(boundary.stats().followers == 1, "F: 40 is a follower")
	var dormant = fresh({"initial_dp": 0.0})
	for p in dormant.individuals.people:
		p.religion_id = ""
		p.devotion = 0.0
	dormant.advance_by(10 * dormant.day_seconds())
	check(dormant.divine.dp > 0 and dormant.divine.presence(dormant, Vector2(24, 26)).weighted == 0 and dormant.stats().followers == 0 and dormant.divine.skills.rain.xp == 0, "F: natural DP creates no Presence/believers/mastery")
	var fulfilled = fresh()
	fulfilled.households.get_home(1).inventory.food = 0.0
	fulfilled.religion.evaluate_needs(fulfilled)
	var prayer = fulfilled.religion.prayers[1]
	var p1 = fulfilled.individuals.get_person(1)
	devotion = p1.devotion
	var rate_before = fulfilled.divine.rate(fulfilled)
	# Controlled fixture: real World harvest -> owned output deposit -> household consumption.
	var cell = fulfilled.world.cell_at(24, 26)
	cell.crops = 16.0
	cell.rain_bonus = 12.0
	cell.crop_cause = fulfilled.record("crop_growth", "controlled attributable growth fixture")
	var crop = fulfilled.world.take_resource(26 * 64 + 24, "crops", 16.0)
	fulfilled.households.deposit_output(fulfilled, 1, "food", crop.amount)
	fulfilled.religion.note_food_evidence(fulfilled, p1, crop.amount, crop.cause, "rain", crop.rain_bonus)
	for n in 2:
		fulfilled.households.consume(fulfilled)
		fulfilled.religion.evaluate_needs(fulfilled)
	check(prayer.status == "fulfilled" and p1.devotion == devotion + fulfilled.rules.evidence_devotion_gain, "F: credible fulfilled need rewards lasting devotion once")
	fulfilled.individuals.adjust_devotion(1, fulfilled.religion.id, 4)
	check(fulfilled.divine.rate(fulfilled) > rate_before, "F: stronger weighted devotion increases subsequent DP")
	devotion = p1.devotion
	fulfilled.religion.note_food_evidence(fulfilled, p1, 10, crop.cause, "rain", 10)
	fulfilled.religion.evaluate_needs(fulfilled)
	check(p1.devotion == devotion and fulfilled.religion.fulfilled_count == 1, "F: resolved need cannot farm repeated faith rewards")
	var oracle = fresh()
	oracle.advance_by(3 * oracle.day_seconds())
	var saint = oracle.religion.living_saints(oracle)[0]
	var priest = oracle.religion.priests[0]
	check(saint != priest and not oracle.religion.eligible(oracle, priest), "G: autonomous Saint and Priest roles are distinct")
	check(not oracle.submit_command({"type": "oracle", "saint_id": priest}).ok, "G: priest cannot receive raw Oracle")
	var activity = oracle.individuals.get_person(saint).activity
	var issued = oracle.submit_command({"type": "oracle", "saint_id": saint})
	check(issued.ok and oracle.religion.saints[saint].quota == 3 and oracle.individuals.get_person(saint).activity == activity, "G/H: issue costs receiver quota without setting Activity")
	check(not oracle.submit_command({"type": "oracle", "saint_id": saint}).ok and oracle.religion.saints[saint].quota == 3, "G: per-Saint active canonical type lock")
	oracle.advance_by(2 * oracle.day_seconds())
	var assignment = oracle.religion.get_oracle(issued.oracle_id)
	check(assignment.stages.heard > 1 and assignment.stages.attempted > 0 and assignment.food_output > 0 and assignment.status == "active", "G/H: local propagation, work/output, no automatic success conclusion")
	oracle.religion.saints[saint].quota = 0
	check(oracle.submit_command({"type": "conclude", "oracle_id": issued.oracle_id}).ok and oracle.religion.saints[saint].quota == -1, "G: conclusion overdraft to exactly -1")
	check(not oracle.submit_command({"type": "oracle", "saint_id": saint}).ok, "G: exhausted quota rejects issuance")
	oracle.advance_to(oracle.religion.saints[saint].next_refill)
	check(oracle.religion.saints[saint].quota == 0, "G/I: exact 3-month refill after fast-forward")
	var ending = fresh()
	ending.advance_by(3 * ending.day_seconds())
	var owner = ending.religion.living_saints(ending)[0]
	var short_oracle = ending.submit_command({"type": "oracle", "saint_id": owner, "months": 0.1})
	var quota = ending.religion.saints[owner].quota
	ending.advance_to(ending.religion.get_oracle(short_oracle.oracle_id).expires_at)
	check(ending.religion.get_oracle(short_oracle.oracle_id).status == "expired" and ending.religion.saints[owner].quota == quota, "G: expiry costs no quota")
	var death_oracle = ending.submit_command({"type": "oracle", "saint_id": owner})
	ending.individuals.die(ending, owner, "controlled receiver-loss fixture")
	ending.advance_by(ending.day_seconds())
	var successor = ending.religion.living_saints(ending)[0]
	check(successor != owner and ending.religion.get_oracle(death_oracle.oracle_id).status == "terminated" and ending.religion.calling_pressure(ending, ending.individuals.get_person(successor)).oracle_id == 0, "G: receiver succession never inherits old assignments")
	var continuity = fresh()
	continuity.advance_by(3 * continuity.day_seconds())
	var lost_receiver = continuity.religion.living_saints(continuity)[0]
	continuity.individuals.die(continuity, lost_receiver, "continuity fixture")
	for p in continuity.individuals.people: p.receptivity = 0.3
	continuity.advance_by(8 * continuity.day_seconds())
	check(continuity.religion.living_saints(continuity).size() == 1, "G: viable believers retain a minimal autonomous reception fallback")
	var multiple = fresh({}, {"saint_max": 2})
	multiple.advance_by(4 * multiple.day_seconds())
	var receivers = multiple.religion.living_saints(multiple)
	check(receivers.size() == 2 and multiple.submit_command({"type": "oracle", "saint_id": receivers[0]}).ok and multiple.submit_command({"type": "oracle", "saint_id": receivers[1]}).ok, "G: per-Saint quotas/locks remain independent")
	var first_assignment = multiple.religion.oracles[0]
	multiple.religion.saints[receivers[0]].quota = -1
	check(not multiple.submit_command({"type": "conclude", "oracle_id": first_assignment.id}).ok and first_assignment.status == "active", "G: conclusion below -1 rejects without ending assignment")
	var plain = fresh({"initial_food_per_household": 80.0})
	plain.advance_by(3 * plain.day_seconds())
	var called = Session.new()
	called.import_state(plain.export_state())
	called.submit_command({"type": "oracle", "saint_id": called.religion.living_saints(called)[0]})
	plain.advance_by(plain.day_seconds() / 3)
	called.advance_by(called.day_seconds() / 3)
	var changed = 0
	for i in plain.individuals.people.size():
		var a = plain.individuals.people[i]
		var b = called.individuals.people[i]
		if a.decision.get("activity", "") != b.decision.get("activity", "") and b.decision.get("calling", {}).get("strength", 0) > 0: changed += 1
	check(changed > 0, "H: identical seeded pair changes feasible priorities due to Calling")
	evidence.append({"scenario": "oracle_counterfactual", "changed_choices": changed, "with_oracle": called.stats(), "without_oracle": plain.stats()})
	var blocked = fresh({"initial_crops": 0.0, "initial_wild_food": 0.0}, {"crop_growth": 0.0, "wild_food_regrowth": 0.0})
	blocked.advance_by(3 * blocked.day_seconds())
	var impossible = blocked.submit_command({"type": "oracle", "saint_id": blocked.religion.living_saints(blocked)[0]})
	blocked.advance_by(2 * blocked.day_seconds())
	check(blocked.religion.get_oracle(impossible.oracle_id).food_output == 0 and blocked.religion.get_oracle(impossible.oracle_id).stages.deprioritized > 0, "H: missing resources block intent with explicit reason")
	var distant = fresh()
	distant.advance_by(3 * distant.day_seconds())
	distant.individuals.get_person(29).x = 57
	distant.individuals.get_person(29).y = 5
	var local = distant.submit_command({"type": "oracle", "saint_id": distant.religion.living_saints(distant)[0]})
	distant.religion.update(distant)
	check(not distant.religion.get_oracle(local.oracle_id).heard.has(29), "H: no global broadcast to distant believers")
	var paused = fresh()
	var frozen = var_to_bytes(paused.export_state())
	paused.paused = true
	paused.advance_wall(60)
	check(var_to_bytes(paused.export_state()) == frozen, "I: Pause freezes authoritative state")
	var normal = fresh()
	var fast = fresh()
	var fastest = fresh()
	fast.speed = 4
	fastest.speed = 16
	normal.advance_wall(80)
	fast.advance_wall(20)
	fastest.advance_wall(5)
	check(same(normal, fast) and same(normal, fastest), "I: 1x/4x/16x yield identical state")
	var bulk = fresh()
	var segmented = fresh()
	bulk.advance_by(15 * bulk.day_seconds())
	for n in 180: segmented.advance_by(segmented.day_seconds() / 12)
	check(same(bulk, segmented), "I/J: bulk and segmented schedules agree")
	var replay_a = fresh()
	var replay_b = fresh()
	for replay in [replay_a, replay_b]:
		replay.submit_command(rain_command(), 3 * replay.day_seconds() + 123)
		replay.submit_command({"type": "oracle", "saint_id": replay.religion.living_saints(replay)[0]}, 4 * replay.day_seconds() + 789)
		replay.advance_to(21 * replay.day_seconds())
	check(same(replay_a, replay_b), "J: deterministic seed plus timestamped commands")
	var saved = fresh()
	saved.submit_command(rain_command(), 3 * saved.day_seconds() + 123)
	saved.submit_command({"type": "oracle", "saint_id": saved.religion.living_saints(saved)[0]}, 4 * saved.day_seconds() + 789)
	saved.individuals.get_person(1).pregnancy_due = 5 * saved.day_seconds() + 321
	saved.individuals.get_person(1).pregnancy_partner = 2
	DirAccess.make_dir_recursive_absolute("res://test-output")
	var saved_ok = saved.save_file("res://test-output/replay.wog")
	var loaded = Session.new()
	check(saved_ok.ok and loaded.load_file("res://test-output/replay.wog").ok and same(saved, loaded), "J: versioned save preserves exact RNG, entities and pending state")
	saved.advance_to(94 * saved.day_seconds())
	loaded.advance_to(94 * loaded.day_seconds())
	check(same(saved, loaded), "J: save/load resumes birth, expiry and quota deadlines identically")
	var snapshot = saved.snapshot()
	snapshot.individuals.people[0].health = -99
	check(saved.individuals.people[0].health >= 0, "J: presentation snapshots do not mutate kernel")
	check(saved.history.events.size() <= saved.rules.history_limit, "J: hot causal history remains bounded")
	var intact = var_to_bytes(saved.export_state())
	check(not saved.import_state({"format": 1, "rules": {"version": "mvp0-2"}}).ok and var_to_bytes(saved.export_state()) == intact, "J: incomplete save rejects before changing the current world")
	for n in 260: saved.submit_command({"type": "unsupported_fixture"})
	check(saved.command_log.size() <= saved.rules.history_limit, "J: recent replay commands remain bounded")
	var file = FileAccess.open("res://test-output/acceptance.json", FileAccess.WRITE)
	file.store_string(JSON.stringify({"ruleset": sim.rules.version, "seed": 1106, "checks": checks, "failures": failures, "evidence": evidence}, "\t"))
	print("RESULT: %d checks, %d failures" % [checks, failures])
	quit(1 if failures > 0 else 0)
