extends RefCounted

var id: String = "religion.river"
var god_id: String = "god.river"
var saints: Dictionary = {}
var priests: Array = []
var oracles: Array = []
var prayers: Dictionary = {}
var next_oracle_id: int = 1
var fulfilled_count: int = 0

func start(_s) -> void:
	saints.clear()
	priests.clear()
	oracles.clear()
	prayers.clear()
	next_oracle_id = 1
	fulfilled_count = 0

func eligible(s, person_id: int) -> bool:
	var person = s.individuals.get_person(person_id)
	return saints.has(person_id) and not person.is_empty() and person.alive and person.religion_id == id

func living_saints(s) -> Array:
	var result: Array = []
	for person_id in saints:
		if eligible(s, person_id): result.append(person_id)
	result.sort()
	return result

func update(s) -> void:
	var receivers = living_saints(s)
	if receivers.size() < int(s.rules.saint_max) and s.time >= int(s.rules.first_listener_days) * s.day_seconds():
		var candidate: Dictionary = {}
		var suitability = -1.0
		for p in s.individuals.people:
			if not p.alive or p.religion_id != id or p.devotion < 40.0 or p.age < float(s.rules.adult_age) or p.receptivity < float(s.rules.saint_min_receptivity) or saints.has(p.id): continue
			var score = p.receptivity + p.devotion / 100.0 + p.health / 1000.0
			if score > suitability:
				suitability = score
				candidate = p
		if not candidate.is_empty():
			saints[candidate.id] = {"person_id": candidate.id, "quota": int(s.rules.quota_initial), "next_refill": s.time + int(s.rules.quota_refill_months) * s.month_seconds(), "activated_at": s.time}
			s.record("saint", "%s在信仰、感受力與自主回應中成為聖者，能接收神諭。" % candidate.name, [candidate.id], [], {"receptivity": candidate.receptivity, "devotion": candidate.devotion, "selection_score": suitability})
	if priests.is_empty() and s.stats().followers >= 4 and not s.settlements.towns.is_empty():
		var candidate: Dictionary = {}
		for p in s.individuals.people:
			if not p.alive or p.religion_id != id or p.devotion < 40.0 or p.skills.preaching < 0.5 or saints.has(p.id): continue
			if candidate.is_empty() or p.skills.preaching > candidate.skills.preaching: candidate = p
		if not candidate.is_empty():
			priests.append(candidate.id)
			s.record("priest", "%s開始組織傳教；祭司職務本身不賦予接收神諭的能力。" % candidate.name, [candidate.id])
	for oracle in oracles:
		if oracle.status != "active": continue
		var sources: Array = [oracle.saint_id]
		for priest_id in priests:
			if oracle.heard.has(priest_id): sources.append(priest_id)
		var newly_heard: Array = []
		for source_id in sources:
			var source = s.individuals.get_person(source_id)
			if not source.alive: continue
			for p in s.individuals.people:
				if not p.alive or p.religion_id != id or oracle.heard.has(p.id) or p.id in newly_heard: continue
				if Vector2(source.x, source.y).distance_to(Vector2(p.x, p.y)) <= float(s.rules.sermon_radius): newly_heard.append(p.id)
		for person_id in newly_heard:
			oracle.heard[person_id] = s.time
		if not newly_heard.is_empty():
			oracle.stages.heard += newly_heard.size()
			var preached = s.record("oracle_heard", "聖者與地方傳教讓 %d 位附近信徒聽見「增加糧食生產」的神意。" % newly_heard.size(), newly_heard, [oracle.event_id], {"local_radius": s.rules.sermon_radius, "interpretation": "善用當地土地與可取得的食物"})
			oracle.last_transmission = preached
	# Ordinary teaching is gradual and local; stronger evidence uses another path.
	for priest_id in priests:
		var source = s.individuals.get_person(priest_id)
		if not source.alive: continue
		for p in s.individuals.people:
			if not p.alive or p.religion_id != id or p.devotion < 20.0 or p.devotion >= 40.0: continue
			if Vector2(source.x, source.y).distance_to(Vector2(p.x, p.y)) <= float(s.rules.sermon_radius): s.individuals.adjust_devotion(p.id, id, 0.06)

func next_deadline(s) -> int:
	var result = 9223372036854775807
	for saint_id in saints:
		if eligible(s, saint_id): result = mini(result, int(saints[saint_id].next_refill))
	for oracle in oracles:
		if oracle.status == "active": result = mini(result, int(oracle.expires_at))
	return result

func process_deadlines(s) -> void:
	for saint_id in saints:
		if not eligible(s, saint_id): continue
		var saint = saints[saint_id]
		while saint.next_refill <= s.time:
			saint.quota = mini(int(s.rules.quota_capacity), saint.quota + 1)
			saint.next_refill += int(s.rules.quota_refill_months) * s.month_seconds()
	for oracle in oracles:
		if oracle.status == "active" and oracle.expires_at <= s.time:
			end_assignment(s, oracle, "expired", "神諭期限到了；停止神諭壓力，保留已發生的世界結果。")

func issue_oracle(s, command: Dictionary) -> Dictionary:
	var saint_id = int(command.get("saint_id", -1))
	var intent = command.get("intent", "food.produce")
	var months = command.get("months", s.rules.oracle_default_months)
	if not eligible(s, saint_id): return {"ok": false, "reason": "目標不是此神的在世聖者；祭司不能僅靠職務接收神諭。"}
	if intent not in s.rules.oracle_catalog: return {"ok": false, "reason": "此 PoC 僅實作 food.produce。"}
	if not (months is int or months is float) or not is_finite(float(months)) or months <= 0 or months > s.rules.oracle_max_months: return {"ok": false, "reason": "神諭期限超出支援範圍。"}
	for existing in oracles:
		if existing.status == "active" and existing.saint_id == saint_id and existing.intent_type == intent: return {"ok": false, "reason": "這位聖者已有同類型的有效神諭。"}
	var saint = saints[saint_id]
	if saint.quota < int(s.rules.quota_issue_cost): return {"ok": false, "reason": "聖者接收配額不足；每三個模擬月恢復 1。"}
	saint.quota -= int(s.rules.quota_issue_cost)
	var person = s.individuals.get_person(saint_id)
	var issued = s.record("oracle_issued", "你向聖者%s傳達「增加糧食生產」；配額剩餘 %d。" % [person.name, saint.quota], [saint_id], [], {"canonical_intent": intent})
	var received = s.record("oracle_received", "%s理解核心神意，將以地方知識向附近信徒傳達。" % person.name, [saint_id], [issued])
	var oracle = {"id": next_oracle_id, "god_id": god_id, "saint_id": saint_id, "intent_type": intent, "payload": {"priority": "increase", "method": "locally_feasible"}, "audience": "local_believers", "issued_at": s.time, "expires_at": s.time + int(months * s.month_seconds()), "status": "active", "event_id": received, "last_transmission": received, "heard": {saint_id: s.time}, "responses": {}, "stages": {"issued": 1, "received": 1, "heard": 1, "accepted": 0, "deprioritized": 0, "attempted": 0, "outcome": 0}, "food_output": 0.0}
	next_oracle_id += 1
	oracles.append(oracle)
	prune_ended()
	return {"ok": true, "reason": "聖者已收到神諭；等待傳播與居民自行決定。", "oracle_id": oracle.id}

func get_oracle(oracle_id: int) -> Dictionary:
	for oracle in oracles:
		if oracle.id == oracle_id: return oracle
	return {}

func conclude(s, oracle_id: int) -> Dictionary:
	var oracle = get_oracle(oracle_id)
	if oracle.is_empty() or oracle.status != "active": return {"ok": false, "reason": "找不到有效的神諭。"}
	var saint = saints.get(oracle.saint_id, {})
	if saint.is_empty() or saint.quota - int(s.rules.quota_conclusion_cost) < int(s.rules.quota_floor): return {"ok": false, "reason": "結束需 1 配額，不能低於 -1。"}
	saint.quota -= int(s.rules.quota_conclusion_cost)
	end_assignment(s, oracle, "concluded", "你宣告這項神諭結束，聖者配額剩餘 %d。" % saint.quota)
	return {"ok": true, "reason": "神諭已結束；凡人的既有成果保留。"}

func end_assignment(s, oracle: Dictionary, status: String, message: String, parent: int = 0) -> void:
	oracle.status = status
	oracle.heard.clear()
	oracle.responses.clear()
	s.record("oracle_" + status, message, [oracle.saint_id], [oracle.event_id] + ([parent] if parent > 0 else []))

func prune_ended() -> void:
	var ended = 0
	for oracle in oracles: ended += int(oracle.status != "active")
	while ended > 24:
		for index in oracles.size():
			if oracles[index].status != "active":
				oracles.remove_at(index)
				ended -= 1
				break

func on_death(s, person_id: int, event_id: int) -> void:
	for oracle in oracles:
		if oracle.status == "active" and oracle.saint_id == person_id: end_assignment(s, oracle, "terminated", "聖者離世，其神諭終止；繼任者不會繼承任務。", event_id)
	priests.erase(person_id)

func calling_pressure(s, p: Dictionary) -> Dictionary:
	var result = {"strength": 0.0, "oracle_id": 0, "event_id": 0}
	if p.religion_id != id: return result
	for oracle in oracles:
		if oracle.status != "active" or not oracle.heard.has(p.id): continue
		var remaining = float(oracle.expires_at - s.time) / maxf(1.0, oracle.expires_at - oracle.issued_at)
		var fade = clampf(remaining * 1.5, 0.2, 1.0)
		var strength = float(s.rules.calling_strength) * p.devotion / 100.0 * fade
		if strength > result.strength: result = {"strength": strength, "oracle_id": oracle.id, "event_id": oracle.last_transmission}
	return result

func note_decision(s, p: Dictionary, choice: Dictionary, production: Dictionary) -> void:
	if choice.calling.oracle_id == 0: return
	var oracle = get_oracle(choice.calling.oracle_id)
	if oracle.is_empty() or oracle.status != "active": return
	var response = oracle.responses.get(p.id, {"accepted": false, "deprioritized": false, "attempted": false, "outcome": false, "event_id": oracle.last_transmission})
	var food_work = choice.activity in ["farm", "gather_food"]
	if not food_work and not response.deprioritized:
		var reason = "當地沒有可取得的作物或野生食物。" if not choice.feasible_food else "家庭、材料或建造工作在當前評分中更優先。"
		response.event_id = s.record("oracle_deprioritized", "%s暫緩神諭：%s" % [p.name, reason], [p.id], [oracle.last_transmission], {"scores": choice.scores, "food_feasible": choice.feasible_food})
		response.deprioritized = true
		oracle.stages.deprioritized += 1
	if food_work:
		if not response.accepted:
			response.event_id = s.record("oracle_accepted", "%s自主提高食物工作的優先序（神諭壓力 %.2f）。" % [p.name, choice.calling.strength], [p.id], [oracle.last_transmission], {"scores": choice.scores, "calling": choice.calling.strength})
			response.accepted = true
			oracle.stages.accepted += 1
		if not response.attempted:
			response.event_id = s.record("oracle_attempted", "%s開始嘗試%s，產出受可達資源與勞動限制。" % [p.name, "收穫" if choice.activity == "farm" else "採集"], [p.id], [response.event_id])
			response.attempted = true
			oracle.stages.attempted += 1
		if production.amount > 0.0:
			oracle.food_output += production.amount
			if not response.outcome:
				response.event_id = s.record("oracle_outcome", "%s的實際勞動取得 %.2f 食物，依家庭／共用分配規則入庫。" % [p.name, production.amount], [p.id, p.household_id], [response.event_id], {"food": production.amount})
				response.outcome = true
				oracle.stages.outcome += 1
			note_food_evidence(s, p, production.amount, response.event_id, "oracle", production.amount)
	oracle.responses[p.id] = response

func note_food_evidence(s, p: Dictionary, amount: float, parent: int, source: String, attributable_amount: float) -> void:
	var prayer = prayers.get(p.household_id, {})
	if prayer.is_empty() or prayer.status != "pending" or p.religion_id != id: return
	if amount <= 0.0 or attributable_amount <= 0.0: return
	# Actual locally harvested output enters storage. No reward occurs at cast/issue time.
	prayer.attributed_food += attributable_amount
	if prayer.evidence_event == 0:
		prayer.evidence_event = s.record("attributed_harvest", "第 %d 戶見證%s相關的實際食物產出。" % [p.household_id, "降雨改善作物" if source == "rain" else "神諭影響勞動"], [p.id, p.household_id], [parent], {"food": amount, "attributable_food": attributable_amount, "source": source})

func evaluate_needs(s) -> void:
	for home in s.households.homes:
		var petitioner: Dictionary = {}
		for person_id in home.members:
			var p = s.individuals.get_person(person_id)
			if p.alive and p.religion_id == id and p.devotion >= 20.0:
				petitioner = p
				break
		if petitioner.is_empty(): continue
		var food_days = s.households.accessible_food(s, home) / maxf(0.1, s.households.food_need(s, home))
		var prayer = prayers.get(home.id, {})
		if (prayer.is_empty() or prayer.status != "pending" and s.time - prayer.closed_at >= int(s.rules.prayer_repeat_days) * s.day_seconds()) and food_days < 2.5:
			var event_id = s.record("prayer", "%s直接祈求食物保障：第 %d 戶可用儲備只剩 %.1f 天。" % [petitioner.name, home.id, food_days], [petitioner.id, home.id], [], {"food_days": food_days})
			prayer = {"household_id": home.id, "person_id": petitioner.id, "status": "pending", "issued_at": s.time, "closed_at": 0, "event_id": event_id, "evidence_event": 0, "attributed_food": 0.0, "recovery_days": 0}
			prayers[home.id] = prayer
		if prayer.is_empty() or prayer.status != "pending": continue
		prayer.recovery_days = prayer.recovery_days + 1 if home.satisfaction >= 0.95 and food_days >= 2.5 else 0
		if prayer.attributed_food >= s.households.food_need(s, home) and prayer.recovery_days >= 2:
			prayer.status = "fulfilled"
			prayer.closed_at = s.time
			fulfilled_count += 1
			s.individuals.adjust_devotion(prayer.person_id, id, float(s.rules.evidence_devotion_gain))
			s.record("prayer_fulfilled", "第 %d 戶的糧食需求確實改善；可信的歸因讓%s的虔誠提高。" % [home.id, s.individuals.get_person(prayer.person_id).name], [home.id, prayer.person_id], [prayer.event_id, prayer.evidence_event], {"attributed_food": prayer.attributed_food, "food_days": food_days, "devotion_gain": s.rules.evidence_devotion_gain})
		elif s.time - prayer.issued_at > 180 * s.day_seconds():
			prayer.status = "unresolved"
			prayer.closed_at = s.time

func state() -> Dictionary:
	return {"id": id, "god_id": god_id, "saints": saints.duplicate(true), "priests": priests.duplicate(), "oracles": oracles.duplicate(true), "prayers": prayers.duplicate(true), "next_oracle_id": next_oracle_id, "fulfilled_count": fulfilled_count}

func restore(data: Dictionary) -> void:
	for key in data: set(key, data[key].duplicate(true) if data[key] is Array or data[key] is Dictionary else data[key])
